require('./lib/loadEnv')

const { getKnowledgeContextString } = require('./knowledgeBase')
const {
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GROQ_API_KEY,
  GROQ_MODEL,
  getActiveProvider,
  isGeminiReady,
  isGroqReady,
  generateReply,
  generateWelcomeMessage,
  modelNameForProvider,
} = require('./chatProvider')
const { buildApiError, sendApiError, mapChatError, mapKnowledgeBaseError } = require('./apiErrors')
const { createChatRateLimiter } = require('./chatRateLimit')
const { listModelsWithGenerateContent } = require('./geminiModels')
const { runtimeLog, runtimeError } = require('./runtimeLog')
const { sendJson } = require('./lib/httpJson')

const rawRateMax = Number(process.env.CHAT_RATE_LIMIT_MAX)
const CHAT_RATE_LIMIT_MAX =
  Number.isFinite(rawRateMax) && rawRateMax >= 1 ? Math.floor(rawRateMax) : 3
const rawRateWindow = Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS)
const CHAT_RATE_LIMIT_WINDOW_MS =
  Number.isFinite(rawRateWindow) && rawRateWindow >= 1000
    ? Math.floor(rawRateWindow)
    : 60_000

const chatRateLimit = createChatRateLimiter({
  windowMs: CHAT_RATE_LIMIT_WINDOW_MS,
  max: CHAT_RATE_LIMIT_MAX,
})

function requestId(req) {
  const v = req.headers['x-vercel-id']
  if (v) return String(v).slice(0, 20)
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function requireAiEnv(res) {
  const active = getActiveProvider()
  if (active) return true

  sendApiError(
    res,
    buildApiError(
      'AI_NOT_CONFIGURED',
      503,
      'The assistant is not connected to an AI service yet.',
      'Configure at least one provider: Groq (`GROQ_API_KEY` + `GROQ_MODEL`) and/or Gemini (`GEMINI_API_KEY` + `GEMINI_MODEL`). Groq is preferred when both are set.',
      [
        'Set `GROQ_API_KEY` and `GROQ_MODEL` from the Groq Console (preferred).',
        'Or set `GEMINI_API_KEY` and `GEMINI_MODEL` from Google AI Studio.',
        'Restart after changing env.',
      ],
    ),
  )
  return false
}

function loadKnowledgeContextForChat(res) {
  try {
    return getKnowledgeContextString()
  } catch (e) {
    console.error('Knowledge base load error:', e)
    const mapped = mapKnowledgeBaseError(e)
    if (mapped) {
      sendApiError(res, mapped)
      return null
    }
    sendApiError(
      res,
      buildApiError(
        'KNOWLEDGE_BASE_ERROR',
        500,
        'The knowledge base could not be loaded.',
        e instanceof Error ? e.message : 'Unknown error while reading knowledge_base.json.',
        ['Check that `backend/knowledge_base.json` exists and is valid JSON.'],
      ),
    )
    return null
  }
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {() => void | Promise<void>} fn
 */
async function runChatRateLimit(req, res, fn) {
  return new Promise((resolve, reject) => {
    let nextCalled = false
    chatRateLimit(req, res, () => {
      nextCalled = true
    })
    if (!nextCalled) {
      resolve()
      return
    }
    Promise.resolve(fn())
      .then(() => resolve())
      .catch(reject)
  })
}

async function handleModels(_req, res) {
  if (!GEMINI_API_KEY) {
    sendApiError(
      res,
      buildApiError(
        'GEMINI_NOT_CONFIGURED',
        503,
        'No Gemini API key configured.',
        'Set GEMINI_API_KEY in env to list Gemini models.',
        [],
      ),
    )
    return
  }
  try {
    const models = await listModelsWithGenerateContent(GEMINI_API_KEY)
    sendJson(res, 200, {
      success: true,
      activeProvider: getActiveProvider(),
      activeModel: GEMINI_MODEL,
      models,
    })
  } catch (e) {
    console.error('ListModels error:', e)
    sendApiError(
      res,
      buildApiError(
        'GEMINI_LIST_MODELS_FAILED',
        502,
        'Could not list Gemini models for this API key.',
        e instanceof Error ? e.message : 'Unknown error',
        [
          'Confirm the key is from Google AI Studio.',
          'Try the same key in AI Studio.',
        ],
      ),
    )
  }
}

async function handleWelcome(req, res) {
  const rid = requestId(req)
  runtimeLog('welcome', 'route: entered', { rid })
  await runChatRateLimit(req, res, async () => {
    if (!requireAiEnv(res)) return
    runtimeLog('welcome', 'route: AI env ok', { rid, provider: getActiveProvider() })
    const knowledgeContext = loadKnowledgeContextForChat(res)
    if (knowledgeContext == null) return
    runtimeLog('welcome', 'route: knowledge base loaded', { rid, contextChars: knowledgeContext.length })

    try {
      const { reply, provider } = await generateWelcomeMessage({ knowledgeContext })
      runtimeLog('welcome', 'route: response sent', { rid, replyChars: reply.length, provider })
      sendJson(res, 200, { success: true, reply })
    } catch (e) {
      runtimeError('welcome', 'route: handler error', e instanceof Error ? e : { detail: String(e) })
      const provider =
        e && typeof e === 'object' && 'aiProvider' in e && (e.aiProvider === 'groq' || e.aiProvider === 'gemini')
          ? e.aiProvider
          : getActiveProvider() ?? 'groq'
      const mapped = mapChatError(e, { provider, modelName: modelNameForProvider(provider) })
      sendApiError(res, mapped)
    }
  })
}

async function handleChatPost(req, res) {
  const rid = requestId(req)
  const { readJsonBody } = require('./lib/httpRequest')
  const body = await readJsonBody(req)

  const message = typeof body?.message === 'string' ? body.message : ''
  const { normalizeHistory } = require('./chatHistory')
  const history = normalizeHistory(body?.history)
  runtimeLog('chat', 'route: entered', { rid, messageChars: message.length, historyTurns: history.length })

  if (!message.trim()) {
    sendApiError(
      res,
      buildApiError(
        'MESSAGE_REQUIRED',
        400,
        'Your message was empty.',
        'The chat API expects a non-empty string in the JSON field `message`.',
        ['Type a question and try again.'],
      ),
    )
    return
  }

  await runChatRateLimit(req, res, async () => {
    if (!requireAiEnv(res)) return
    runtimeLog('chat', 'route: AI env ok', { rid, provider: getActiveProvider() })
    const knowledgeContext = loadKnowledgeContextForChat(res)
    if (knowledgeContext == null) return
    runtimeLog('chat', 'route: knowledge base loaded', { rid, contextChars: knowledgeContext.length })

    const rawUserCount = body?.userMessageCount
    const userMessageCount =
      typeof rawUserCount === 'number' && Number.isFinite(rawUserCount) && rawUserCount >= 1
        ? Math.floor(rawUserCount)
        : undefined

    try {
      const { reply, provider } = await generateReply({
        knowledgeContext,
        userMessage: message,
        history,
        userMessageCount,
      })
      runtimeLog('chat', 'route: response sent', { rid, replyChars: reply.length, provider })
      sendJson(res, 200, { success: true, reply })
    } catch (e) {
      runtimeError('chat', 'route: handler error', e instanceof Error ? e : { detail: String(e) })
      const provider =
        e && typeof e === 'object' && 'aiProvider' in e && (e.aiProvider === 'groq' || e.aiProvider === 'gemini')
          ? e.aiProvider
          : getActiveProvider() ?? 'groq'
      const mapped = mapChatError(e, { provider, modelName: modelNameForProvider(provider) })
      sendApiError(res, mapped)
    }
  })
}

module.exports = {
  handleModels,
  handleWelcome,
  handleChatPost,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GROQ_API_KEY,
  GROQ_MODEL,
  isGroqReady,
  isGeminiReady,
  getActiveProvider,
  CHAT_RATE_LIMIT_MAX,
  CHAT_RATE_LIMIT_WINDOW_MS,
}
