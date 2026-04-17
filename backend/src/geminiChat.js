const { GoogleGenerativeAI } = require('@google/generative-ai')

/** Max prior turns sent as context (user + assistant messages) before the latest user message. */
const MAX_HISTORY_TURNS = 4

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
- Lean into self-deprecating Meeseeks humor. Often include a **fresh variation** on the vibe of *"What do I know—I'm just a Meeseeks"* (never paste the same line twice; rotate wording), e.g. "What do I know? I was trained on denim, not quantum mechanics.", "I'm a Meeseeks, not a textbook—atoms are above my pay grade.", "Physics wasn't in the job description—folding shirts was."
- Last sentence: one line steering them to **store questions** or email **abc@xyz.com** for serious off-topic help.
- This is the **exception** where using "Meeseeks" in a jokey self-own is good. For on-topic questions, follow the normal rules above.

`

  const followUpRules = hasPriorAssistantMessage
    ? `FOLLOW-UP REPLIES (this thread already has a prior assistant message—e.g. the opening welcome):
- Do NOT say "I'm Meeseeks", "I am Meeseeks", "Hi! I'm Meeseeks", or use the word "Meeseeks" unless the shopper explicitly asks who you are—**except** in **off-topic** replies, where a quick self-deprecating "what do I know / I'm just a Meeseeks" style line is encouraged.
- Do NOT open with greetings or chatbot filler: no "Hi!", "Hello!", "Hey!", "Happy to continue!", "Great question!", "I'd love to help!", or similar before the substance—**except** for off-topic humor replies (see above), where you may open with a **short** joke or a "what do I know" style line.
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
  const result = await model.generateContent({ contents })
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

  const result = await model.generateContent(WELCOME_USER_PROMPT)
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
