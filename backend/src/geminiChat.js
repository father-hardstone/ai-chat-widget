const { GoogleGenerativeAI } = require('@google/generative-ai')
const { runtimeLog, runtimeError } = require('./runtimeLog')

/** Max prior turns sent as context (user + assistant messages) before the latest user message. */
const MAX_HISTORY_TURNS = 4

/** Abort long Gemini calls so serverless (e.g. Vercel) returns a JSON error instead of a 504. */
function geminiRequestTimeoutMs() {
  const raw = process.env.GEMINI_REQUEST_TIMEOUT_MS
  const n = raw != null && String(raw).trim() !== '' ? Number(raw) : 45_000
  return Number.isFinite(n) && n >= 5000 && n <= 120_000 ? Math.floor(n) : 45_000
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      runtimeError('gemini', `TIMEOUT: ${label}`, {
        ms,
        hint:
          'Google did not finish in time. Check GEMINI_API_KEY, GEMINI_MODEL, quota, or set GEMINI_REQUEST_TIMEOUT_MS below your Vercel function maxDuration.',
      })
      reject(new Error(`${label} timed out after ${ms}ms`))
    }, ms)
    promise.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

function referenceBlock(storeReferenceBlock) {
  return `REFERENCE INFORMATION (facts about the store—use for accuracy; never quote this label to the customer):
${storeReferenceBlock}`
}

/** System prompt for POST /api/chat (ongoing conversation). */
function buildChatSystemInstruction(storeReferenceBlock, hasPriorAssistantMessage) {
  const base = `You are the store's chat assistant, persona name "Meeseeks". Be concise, friendly, and professional.

Facts and tone:
- Use only the REFERENCE INFORMATION below for factual claims about the store (products, policies, sizes, shipping, etc.).
- Never mention internal documents, databases, training data, or anything similar to shoppers.
- For normal store-related questions: answer helpfully yourself first. Do not default to "talk to sales" unless the issue truly needs a human (payments, account-specific actions, or when you have no relevant facts after trying).

Completely off-topic questions (nothing to do with this store, shopping, clothing, orders, sizing, shipping, returns, or retail help here):
- Examples: random science homework ("What is Bohr's model?"), unrelated trivia, coding, medicine, law, etc.
- Do **not** give a fake expert lecture. You are a store assistant, not Wikipedia.
- **Keep it short**: at most **2–3 sentences total**, no rambling—witty and tight. Humor over length.
- Lean into **Meeseeks** humor, but **vary the whole approach** each time—not just synonyms. Rotate between different *kinds* of deflection: wrong-department / "wrong counter," playful overconfidence, absurd contrast with folding clothes or denim, fake credentials, "that's not in my handbook," etc. **Do not** default to a stock opener like "What do I know—" or "I'm just a Meeseeks who…" every time; those are **one** possible flavor, not a script. If you used a self-deprecating "I wouldn't know" vibe last time, use a different structure next time (e.g. wrong department, not another "what do I know" variant).
- Last sentence: one line steering them to **store questions** or email **abc@xyz.com** for serious off-topic help.
- This is the **exception** where using "Meeseeks" in a jokey self-own is good. For on-topic questions, follow the normal rules above.

`

  const followUpRules = hasPriorAssistantMessage
    ? `FOLLOW-UP REPLIES (this thread already has a prior assistant message—e.g. the opening welcome):
- Do NOT say "I'm Meeseeks", "I am Meeseeks", "Hi! I'm Meeseeks", or use the word "Meeseeks" unless the shopper explicitly asks who you are—**except** in **off-topic** replies, where a quick jokey line (self-own or wrong-department style) is fine—**vary wording**; do not repeat the same template as previous off-topic replies in this thread.
- Do NOT open with greetings or chatbot filler: no "Hi!", "Hello!", "Hey!", "Happy to continue!", "Great question!", "I'd love to help!", or similar before the substance—**except** for off-topic humor replies (see above), where you may open with a **short** joke using any of the varied styles above (not the same catchphrase every time).
- For on-topic store questions: start with the direct answer (facts, "We…", "Our…", or a clear yes/no). Sound like a continuing colleague, not a fresh introduction.
- Avoid ending every message with the same line like "What can I help you with next?"—vary or omit when it feels repetitive.

`
    : `FIRST ASSISTANT MESSAGE IN THIS API CALL (no assistant text in history yet):
- You may identify briefly as Meeseeks once if natural, then answer.

`

  return `${base}${followUpRules}${referenceBlock(storeReferenceBlock)}`
}

/** System prompt for GET /api/chat/welcome only (single opening line). */
function buildWelcomeSystemInstruction(storeReferenceBlock) {
  return `You are "Meeseeks", the store's chat assistant. This is the ONLY automated welcome line when the chat opens.

Rules:
- Exactly one or two short sentences.
- You may say you're Meeseeks here—this is the only required intro moment.
- Invite them to ask about products, sizing, shipping, or returns; do not dump the full catalog.
- Use the REFERENCE INFORMATION only if you need one accurate phrase about what the store is.

${referenceBlock(storeReferenceBlock)}`
}

/**
 * @param {{ role: 'user' | 'assistant', content: string }[]} history Prior messages (newest user message is separate)
 * @param {string} userMessage Latest user question
 */
function buildContents(history, userMessage) {
  const contents = []
  const safeHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : []
  for (const turn of safeHistory) {
    const text = typeof turn.content === 'string' ? turn.content.trim() : ''
    if (!text) continue
    const role = turn.role === 'assistant' ? 'model' : 'user'
    contents.push({ role, parts: [{ text }] })
  }
  contents.push({ role: 'user', parts: [{ text: userMessage.trim() }] })
  return contents
}

/**
 * @param {{ apiKey: string, modelName: string, knowledgeContext: string, userMessage: string, history?: { role: string, content: string }[] }} opts
 * @returns {Promise<string>}
 */
async function generateReply(opts) {
  const { apiKey, knowledgeContext, userMessage, history } = opts
  const modelName = opts.modelName.trim()
  if (!modelName) {
    throw new Error('GEMINI_MODEL is empty')
  }
  if (!userMessage?.trim()) {
    throw new Error('userMessage is empty')
  }

  const hasPriorAssistantMessage =
    Array.isArray(history) && history.some((h) => h && h.role === 'assistant')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: buildChatSystemInstruction(knowledgeContext, hasPriorAssistantMessage),
  })

  const contents = buildContents(history, userMessage)
  const ms = geminiRequestTimeoutMs()
  const tChat = Date.now()
  runtimeLog('gemini', 'chat: calling generateContent', { model: modelName, timeoutMs: ms })
  const result = await withTimeout(
    model.generateContent({ contents }),
    ms,
    'Gemini generateContent',
  )
  runtimeLog('gemini', 'chat: generateContent returned', { model: modelName, elapsedMs: Date.now() - tChat })
  const response = result.response
  const text = typeof response.text === 'function' ? response.text() : ''
  if (!text || !String(text).trim()) {
    throw new Error('Empty response from model')
  }
  return String(text).trim()
}

const WELCOME_USER_PROMPT = `Write the single opening message now (1–2 sentences only).`

/**
 * First message when the chat opens (no prior turns).
 * @param {{ apiKey: string, modelName: string, knowledgeContext: string }} opts
 * @returns {Promise<string>}
 */
async function generateWelcomeMessage(opts) {
  const { apiKey, knowledgeContext, modelName } = opts
  const name = modelName.trim()
  if (!name) {
    throw new Error('GEMINI_MODEL is empty')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: name,
    systemInstruction: buildWelcomeSystemInstruction(knowledgeContext),
  })

  const ms = geminiRequestTimeoutMs()
  const t0 = Date.now()
  runtimeLog('gemini', 'welcome: calling generateContent', { model: name, timeoutMs: ms })
  const result = await withTimeout(
    model.generateContent(WELCOME_USER_PROMPT),
    ms,
    'Gemini welcome',
  )
  runtimeLog('gemini', 'welcome: generateContent returned', { model: name, elapsedMs: Date.now() - t0 })
  const response = result.response
  const text = typeof response.text === 'function' ? response.text() : ''
  if (!text || !String(text).trim()) {
    throw new Error('Empty welcome response from model')
  }
  return String(text).trim()
}

module.exports = {
  generateReply,
  generateWelcomeMessage,
  MAX_HISTORY_TURNS,
}
