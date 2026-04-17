const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const express = require('express')
const cors = require('cors')

const { getKnowledgeContextString } = require('./knowledgeBase')
const { generateReply, generateWelcomeMessage } = require('./geminiChat')
const { normalizeHistory } = require('./chatHistory')
const {
  buildApiError,
  sendApiError,
  mapGeminiError,
  mapKnowledgeBaseError,
  mapBodyParserError,
} = require('./apiErrors')
const { createChatRateLimiter } = require('./chatRateLimit')
const { listModelsWithGenerateContent } = require('./geminiModels')

/** @returns {string[]} */
function allowedOriginsList() {
  const fallback = ['http://localhost:5173']
  const s = (process.env.CLIENT_ORIGIN ?? '').trim()
  if (!s) return fallback
  const list = s.split(',').map((x) => x.trim()).filter(Boolean)
  return list.length ? list : fallback
}
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''
const GEMINI_MODEL = (process.env.GEMINI_MODEL ?? '').trim()

const rawRateMax = Number(process.env.CHAT_RATE_LIMIT_MAX)
const CHAT_RATE_LIMIT_MAX =
  Number.isFinite(rawRateMax) && rawRateMax >= 1 ? Math.floor(rawRateMax) : 3
const rawRateWindow = Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS)
const CHAT_RATE_LIMIT_WINDOW_MS =
  Number.isFinite(rawRateWindow) && rawRateWindow >= 1000
    ? Math.floor(rawRateWindow)
    : 60_000

const app = express()

/**
 * Vercel `rewrites` send traffic to `/api`; restore the browser path so Express routes (`/health`, `/api/chat`, …) match.
 * Header names vary by runtime; harmless if absent.
 */
if (process.env.VERCEL) {
  app.use((req, _res, next) => {
    const path =
      req.headers['x-vercel-forwarded-path'] ||
      req.headers['x-vercel-original-path'] ||
      req.headers['x-invoke-path'] ||
      req.headers['x-matched-path']
    if (typeof path === 'string' && path.startsWith('/')) {
      const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
      req.url = path + qs
    }
    next()
  })
}

/** Behind Vercel / proxies, trust X-Forwarded-* for req.ip (rate limit) and secure cookies. */
if (
  process.env.VERCEL ||
  process.env.TRUST_PROXY === '1' ||
  /^true$/i.test(process.env.TRUST_PROXY ?? '')
) {
  app.set('trust proxy', 1)
}

app.use(
  cors({
    origin(origin, callback) {
      const allowed = allowedOriginsList()
      if (!origin) {
        callback(null, true)
        return
      }
      if (allowed.includes(origin)) {
        callback(null, true)
        return
      }
      console.warn(
        '[cors] blocked Origin:',
        origin,
        '| Add it to CLIENT_ORIGIN on the backend (comma-separated). Currently allowed:',
        allowed,
      )
      callback(null, false)
    },
    /** Cache preflight (OPTIONS) so the browser repeats it rarely, not on every request (browser caps apply, often ~2h). */
    maxAge: 86400,
    methods: ['GET', 'POST', 'OPTIONS'],
  }),
)

if (process.env.LOG_REQUESTS !== '0') {
  app.use((req, _res, next) => {
    console.log(
      '[express]',
      req.method,
      req.originalUrl || req.url,
      req.headers.origin ? `origin=${req.headers.origin}` : '',
    )
    next()
  })
}
app.use(express.json({ limit: '1mb' }))

/** Browsers request these on the API host; answer immediately (rewrite `/(.*)` would otherwise hit the app for every asset). */
app.get('/favicon.ico', (_req, res) => res.status(204).end())
app.get('/favicon.png', (_req, res) => res.status(204).end())

const chatRateLimit = createChatRateLimiter({
  windowMs: CHAT_RATE_LIMIT_WINDOW_MS,
  max: CHAT_RATE_LIMIT_MAX,
})

function requireGeminiEnv(res) {
  if (!GEMINI_API_KEY) {
    sendApiError(
      res,
      buildApiError(
        'GEMINI_NOT_CONFIGURED',
        503,
        'The assistant is not connected to the AI service yet.',
        'The backend has no `GEMINI_API_KEY`. Without it, the server cannot call Google Gemini on your behalf.',
        [
          'Create `backend/.env` from `backend/.env.example`.',
          'Set `GEMINI_API_KEY` to your key from Google AI Studio.',
          'Restart `npm run dev` so the backend reloads environment variables.',
        ],
      ),
    )
    return false
  }
  if (!GEMINI_MODEL) {
    sendApiError(
      res,
      buildApiError(
        'GEMINI_MODEL_NOT_SET',
        503,
        'No Gemini model is configured.',
        'Set `GEMINI_MODEL` in `backend/.env` to the model id you want to use (no default is built into the app).',
        [
          'With the backend running and `GEMINI_API_KEY` set, call GET /api/gemini/models and copy an `id` from the JSON into `GEMINI_MODEL`.',
          'Restart the backend after changing `.env`.',
        ],
      ),
    )
    return false
  }
  return true
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
        ['Check that `backend/knowledge_base.json` exists and is valid JSON.', 'See backend logs for the full error.'],
      ),
    )
    return null
  }
}

/** Root — browsers and uptime checks often hit `/`; avoid a confusing 404. */
app.get('/', (_req, res) => {
  res.json({
    success: true,
    service: 'ai-chat-widget-api',
    message: 'Chat API is running. Use GET /health, GET /api/chat/welcome, or POST /api/chat.',
    endpoints: {
      health: 'GET /health',
      welcome: 'GET /api/chat/welcome',
      chat: 'POST /api/chat',
      models: 'GET /api/gemini/models',
    },
  })
})

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    success: true,
    geminiConfigured: Boolean(GEMINI_API_KEY),
    geminiModelConfigured: Boolean(GEMINI_MODEL),
    geminiModel: GEMINI_MODEL || null,
    chatReady: Boolean(GEMINI_API_KEY && GEMINI_MODEL),
  })
})

/** Lists model ids your API key can use with generateContent (fixes wrong GEMINI_MODEL / 404). */
app.get('/api/gemini/models', async (_req, res) => {
  if (!GEMINI_API_KEY) {
    sendApiError(
      res,
      buildApiError(
        'GEMINI_NOT_CONFIGURED',
        503,
        'No API key configured.',
        'Set GEMINI_API_KEY in backend/.env to list models.',
        [],
      ),
    )
    return
  }
  try {
    const models = await listModelsWithGenerateContent(GEMINI_API_KEY)
    res.json({
      success: true,
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
          'Confirm the key is from Google AI Studio and has Generative Language API access.',
          'Try the same key in AI Studio and check which models appear there.',
        ],
      ),
    )
  }
})

/** Opening line when the chat panel loads (same Gemini config + reference as /api/chat). */
app.get('/api/chat/welcome', chatRateLimit, async (_req, res) => {
  if (!requireGeminiEnv(res)) return
  const knowledgeContext = loadKnowledgeContextForChat(res)
  if (knowledgeContext == null) return

  try {
    const reply = await generateWelcomeMessage({
      apiKey: GEMINI_API_KEY,
      modelName: GEMINI_MODEL,
      knowledgeContext,
    })
    res.json({ success: true, reply })
  } catch (e) {
    console.error('Gemini welcome error:', e)
    const mapped = mapGeminiError(e, { modelName: GEMINI_MODEL })
    sendApiError(res, mapped)
  }
})

app.post('/api/chat', chatRateLimit, async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message : ''
  const history = normalizeHistory(req.body?.history)

  if (!message.trim()) {
    sendApiError(
      res,
      buildApiError(
        'MESSAGE_REQUIRED',
        400,
        'Your message was empty.',
        'The chat API expects a non-empty string in the JSON field `message`.',
        [
          'Type a question and try again.',
          'Optional: `history` may be an array of up to 4 prior `{ "role": "user"|"assistant", "content": "..." }` turns for context.',
        ],
      ),
    )
    return
  }

  if (!requireGeminiEnv(res)) return
  const knowledgeContext = loadKnowledgeContextForChat(res)
  if (knowledgeContext == null) return

  try {
    const reply = await generateReply({
      apiKey: GEMINI_API_KEY,
      modelName: GEMINI_MODEL,
      knowledgeContext,
      userMessage: message,
      history,
    })
    res.json({ success: true, reply })
  } catch (e) {
    console.error('Gemini error:', e)
    const mapped = mapGeminiError(e, { modelName: GEMINI_MODEL })
    sendApiError(res, mapped)
  }
})

app.use((req, res) => {
  sendApiError(
    res,
    buildApiError(
      'NOT_FOUND',
      404,
      'No route matches this URL.',
      `The server does not handle ${req.method} ${req.originalUrl}. For chat, use POST /api/chat with JSON body {"message":"..."}.`,
      ['Open the frontend at the Vite dev URL (usually http://localhost:5173).', 'Use GET /health to verify the backend is running.'],
    ),
  )
})

app.use((err, req, res, _next) => {
  const parsed = mapBodyParserError(err, req)
  if (parsed) {
    sendApiError(res, parsed)
    return
  }
  console.error('Unhandled error:', err)
  sendApiError(
    res,
    buildApiError(
      'INTERNAL_ERROR',
      500,
      'Something went wrong on the server.',
      err instanceof Error ? err.message : 'Unknown error.',
      ['Check the backend terminal logs for a stack trace.', 'Restart the backend if it is in a bad state.'],
    ),
  )
})

module.exports = app
