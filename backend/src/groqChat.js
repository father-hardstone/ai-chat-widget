const { runtimeLog } = require('./runtimeLog')
const {
  MAX_HISTORY_TURNS,
  buildChatSystemInstruction,
  buildWelcomeSystemInstruction,
  resolveUserMessageCount,
  WELCOME_USER_PROMPT,
} = require('./chatPrompts')
const { chatRequestTimeoutMs, withTimeout } = require('./chatTimeout')

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

class GroqApiError extends Error {
  /**
   * @param {number} status
   * @param {string} statusText
   * @param {unknown} body
   */
  constructor(status, statusText, body) {
    const detail =
      body && typeof body === 'object' && body.error && typeof body.error.message === 'string'
        ? body.error.message
        : typeof body === 'string'
          ? body.slice(0, 500)
          : ''
    super(`Groq HTTP ${status}${detail ? `: ${detail}` : ''}`)
    this.name = 'GroqApiError'
    this.status = status
    this.statusText = statusText
    this.body = body
  }
}

/**
 * @param {{ role: 'user' | 'assistant', content: string }[]} history
 * @param {string} userMessage
 */
function buildMessages(systemInstruction, history, userMessage) {
  /** @type {{ role: 'system' | 'user' | 'assistant', content: string }[]} */
  const messages = [{ role: 'system', content: systemInstruction }]
  const safeHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : []
  for (const turn of safeHistory) {
    const text = typeof turn.content === 'string' ? turn.content.trim() : ''
    if (!text) continue
    messages.push({
      role: turn.role === 'assistant' ? 'assistant' : 'user',
      content: text,
    })
  }
  messages.push({ role: 'user', content: userMessage.trim() })
  return messages
}

/**
 * @param {{ apiKey: string, modelName: string, messages: { role: string, content: string }[] }} opts
 * @returns {Promise<string>}
 */
async function callGroqChat(opts) {
  const { apiKey, modelName, messages } = opts
  const res = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature: 0.7,
    }),
  })

  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new GroqApiError(res.status, res.statusText, text)
  }

  if (!res.ok) {
    throw new GroqApiError(res.status, res.statusText, data)
  }

  const content = data?.choices?.[0]?.message?.content
  if (!content || !String(content).trim()) {
    throw new Error('Empty response from model')
  }
  return String(content).trim()
}

/**
 * @param {{ apiKey: string, modelName: string, knowledgeContext: string, userMessage: string, history?: { role: string, content: string }[], userMessageCount?: number }} opts
 * @returns {Promise<string>}
 */
async function generateReply(opts) {
  const { apiKey, knowledgeContext, userMessage, history } = opts
  const modelName = opts.modelName.trim()
  if (!modelName) {
    throw new Error('GROQ_MODEL is empty')
  }
  if (!userMessage?.trim()) {
    throw new Error('userMessage is empty')
  }

  const userMessageCount = resolveUserMessageCount(history, userMessage, opts.userMessageCount)
  const hasPriorAssistantMessage =
    Array.isArray(history) && history.some((h) => h && h.role === 'assistant')

  const messages = buildMessages(
    buildChatSystemInstruction(knowledgeContext, hasPriorAssistantMessage, { userMessageCount }),
    history,
    userMessage,
  )

  const ms = chatRequestTimeoutMs()
  const tChat = Date.now()
  runtimeLog('groq', 'chat: calling chat/completions', { model: modelName, timeoutMs: ms })
  const reply = await withTimeout(
    callGroqChat({ apiKey, modelName, messages }),
    ms,
    'Groq chat/completions',
    'groq',
    'Groq did not finish in time. Check GROQ_API_KEY, GROQ_MODEL, quota, or set CHAT_REQUEST_TIMEOUT_MS below your Vercel function maxDuration.',
  )
  runtimeLog('groq', 'chat: chat/completions returned', { model: modelName, elapsedMs: Date.now() - tChat })
  return reply
}

/**
 * @param {{ apiKey: string, modelName: string, knowledgeContext: string }} opts
 * @returns {Promise<string>}
 */
async function generateWelcomeMessage(opts) {
  const { apiKey, knowledgeContext, modelName } = opts
  const name = modelName.trim()
  if (!name) {
    throw new Error('GROQ_MODEL is empty')
  }

  const messages = [
    { role: 'system', content: buildWelcomeSystemInstruction(knowledgeContext) },
    { role: 'user', content: WELCOME_USER_PROMPT },
  ]

  const ms = chatRequestTimeoutMs()
  const t0 = Date.now()
  runtimeLog('groq', 'welcome: calling chat/completions', { model: name, timeoutMs: ms })
  const reply = await withTimeout(
    callGroqChat({ apiKey, modelName: name, messages }),
    ms,
    'Groq welcome',
    'groq',
    'Groq did not finish in time. Check GROQ_API_KEY, GROQ_MODEL, quota, or set CHAT_REQUEST_TIMEOUT_MS below your Vercel function maxDuration.',
  )
  runtimeLog('groq', 'welcome: chat/completions returned', { model: name, elapsedMs: Date.now() - t0 })
  return reply
}

module.exports = {
  GroqApiError,
  generateReply,
  generateWelcomeMessage,
}
