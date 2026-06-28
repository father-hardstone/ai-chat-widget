const geminiChat = require('./geminiChat')
const groqChat = require('./groqChat')
const { runtimeLog, runtimeError } = require('./runtimeLog')

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? ''
const GROQ_MODEL = (process.env.GROQ_MODEL ?? '').trim()
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''
const GEMINI_MODEL = (process.env.GEMINI_MODEL ?? '').trim()

const AI_FALLBACK_ENABLED = process.env.AI_FALLBACK !== '0'

/** @typedef {'groq' | 'gemini'} AiProviderId */

function isGroqReady() {
  return Boolean(GROQ_API_KEY && GROQ_MODEL)
}

function isGeminiReady() {
  return Boolean(GEMINI_API_KEY && GEMINI_MODEL)
}

/**
 * @returns {AiProviderId[]}
 */
function resolveProviderOrder() {
  const explicit = (process.env.AI_PROVIDER ?? 'auto').trim().toLowerCase()

  if (explicit === 'groq') {
    /** @type {AiProviderId[]} */
    const order = []
    if (isGroqReady()) order.push('groq')
    if (AI_FALLBACK_ENABLED && isGeminiReady()) order.push('gemini')
    return order
  }

  if (explicit === 'gemini') {
    /** @type {AiProviderId[]} */
    const order = []
    if (isGeminiReady()) order.push('gemini')
    if (AI_FALLBACK_ENABLED && isGroqReady()) order.push('groq')
    return order
  }

  /** auto: Groq preferred when configured */
  /** @type {AiProviderId[]} */
  const order = []
  if (isGroqReady()) order.push('groq')
  if (isGeminiReady()) order.push('gemini')
  return order
}

function getActiveProvider() {
  return resolveProviderOrder()[0] ?? null
}

/**
 * @param {AiProviderId} provider
 * @param {'reply' | 'welcome'} kind
 * @param {Record<string, unknown>} opts
 * @returns {Promise<string>}
 */
async function callProvider(provider, kind, opts) {
  if (provider === 'groq') {
    if (kind === 'welcome') {
      return groqChat.generateWelcomeMessage({
        apiKey: GROQ_API_KEY,
        modelName: GROQ_MODEL,
        knowledgeContext: /** @type {string} */ (opts.knowledgeContext),
      })
    }
    return groqChat.generateReply({
      apiKey: GROQ_API_KEY,
      modelName: GROQ_MODEL,
      knowledgeContext: /** @type {string} */ (opts.knowledgeContext),
      userMessage: /** @type {string} */ (opts.userMessage),
      history: /** @type {{ role: string, content: string }[] | undefined} */ (opts.history),
      userMessageCount: /** @type {number | undefined} */ (opts.userMessageCount),
    })
  }

  if (kind === 'welcome') {
    return geminiChat.generateWelcomeMessage({
      apiKey: GEMINI_API_KEY,
      modelName: GEMINI_MODEL,
      knowledgeContext: /** @type {string} */ (opts.knowledgeContext),
    })
  }
  return geminiChat.generateReply({
    apiKey: GEMINI_API_KEY,
    modelName: GEMINI_MODEL,
    knowledgeContext: /** @type {string} */ (opts.knowledgeContext),
    userMessage: /** @type {string} */ (opts.userMessage),
    history: /** @type {{ role: string, content: string }[] | undefined} */ (opts.history),
    userMessageCount: /** @type {number | undefined} */ (opts.userMessageCount),
  })
}

/**
 * @param {'reply' | 'welcome'} kind
 * @param {Record<string, unknown>} opts
 * @returns {Promise<{ reply: string, provider: AiProviderId }>}
 */
async function generateWithProviders(kind, opts) {
  const providers = resolveProviderOrder()
  if (providers.length === 0) {
    throw new Error('No AI provider is configured')
  }

  /** @type {unknown} */
  let lastError = null

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i]
    const isFallback = i > 0
    if (isFallback && !AI_FALLBACK_ENABLED) break

    try {
      if (isFallback) {
        runtimeLog('ai', `${kind}: falling back to ${provider}`, {})
      } else {
        runtimeLog('ai', `${kind}: using ${provider}`, {})
      }
      const reply = await callProvider(provider, kind, opts)
      return { reply, provider }
    } catch (e) {
      lastError = e
      if (e instanceof Error) {
        e.aiProvider = provider
      }
      runtimeError('ai', `${kind}: ${provider} failed`, e instanceof Error ? e : { detail: String(e) })
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All AI providers failed')
}

/**
 * @param {Record<string, unknown>} opts
 * @returns {Promise<{ reply: string, provider: AiProviderId }>}
 */
async function generateReply(opts) {
  return generateWithProviders('reply', opts)
}

/**
 * @param {Record<string, unknown>} opts
 * @returns {Promise<{ reply: string, provider: AiProviderId }>}
 */
async function generateWelcomeMessage(opts) {
  return generateWithProviders('welcome', opts)
}

function modelNameForProvider(provider) {
  return provider === 'groq' ? GROQ_MODEL : GEMINI_MODEL
}

module.exports = {
  GROQ_API_KEY,
  GROQ_MODEL,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  AI_FALLBACK_ENABLED,
  isGroqReady,
  isGeminiReady,
  resolveProviderOrder,
  getActiveProvider,
  generateReply,
  generateWelcomeMessage,
  modelNameForProvider,
}
