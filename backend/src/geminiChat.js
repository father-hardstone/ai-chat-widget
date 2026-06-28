const { GoogleGenerativeAI } = require('@google/generative-ai')
const { runtimeLog } = require('./runtimeLog')
const {
  MAX_HISTORY_TURNS,
  buildChatSystemInstruction,
  buildWelcomeSystemInstruction,
  resolveUserMessageCount,
  WELCOME_USER_PROMPT,
} = require('./chatPrompts')
const { chatRequestTimeoutMs, withTimeout } = require('./chatTimeout')

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
 * @param {{ apiKey: string, modelName: string, knowledgeContext: string, userMessage: string, history?: { role: string, content: string }[], userMessageCount?: number }} opts
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

  const userMessageCount = resolveUserMessageCount(history, userMessage, opts.userMessageCount)

  const hasPriorAssistantMessage =
    Array.isArray(history) && history.some((h) => h && h.role === 'assistant')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: buildChatSystemInstruction(knowledgeContext, hasPriorAssistantMessage, {
      userMessageCount,
    }),
  })

  const contents = buildContents(history, userMessage)
  const ms = chatRequestTimeoutMs()
  const tChat = Date.now()
  runtimeLog('gemini', 'chat: calling generateContent', { model: modelName, timeoutMs: ms })
  const result = await withTimeout(
    model.generateContent({ contents }),
    ms,
    'Gemini generateContent',
    'gemini',
    'Google did not finish in time. Check GEMINI_API_KEY, GEMINI_MODEL, quota, or set CHAT_REQUEST_TIMEOUT_MS below your Vercel function maxDuration.',
  )
  runtimeLog('gemini', 'chat: generateContent returned', { model: modelName, elapsedMs: Date.now() - tChat })
  const response = result.response
  const text = typeof response.text === 'function' ? response.text() : ''
  if (!text || !String(text).trim()) {
    throw new Error('Empty response from model')
  }
  return String(text).trim()
}

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

  const ms = chatRequestTimeoutMs()
  const t0 = Date.now()
  runtimeLog('gemini', 'welcome: calling generateContent', { model: name, timeoutMs: ms })
  const result = await withTimeout(
    model.generateContent(WELCOME_USER_PROMPT),
    ms,
    'Gemini welcome',
    'gemini',
    'Google did not finish in time. Check GEMINI_API_KEY, GEMINI_MODEL, quota, or set CHAT_REQUEST_TIMEOUT_MS below your Vercel function maxDuration.',
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
