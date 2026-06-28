require('./lib/loadEnv')

const http = require('http')
const { URL } = require('url')
const { applyCors, handlePreflight } = require('./lib/httpCors')
const { augmentRequest } = require('./lib/httpRequest')
const { buildApiError, sendApiError } = require('./apiErrors')
const { handleRoot, handleHealth } = require('./routes/lightHandlers')
const {
  handleModels,
  handleWelcome,
  handleChatPost,
  CHAT_RATE_LIMIT_MAX,
  CHAT_RATE_LIMIT_WINDOW_MS,
  isGroqReady,
  isGeminiReady,
  getActiveProvider,
} = require('./chatShared')

function handleFavicon(_req, res) {
  res.statusCode = 204
  res.end()
}

const PORT = Number(process.env.PORT ?? 3001)

async function dispatch(req, res) {
  augmentRequest(req)
  applyCors(req, res)
  if (handlePreflight(req, res)) return

  if (process.env.LOG_REQUESTS !== '0') {
    const u = req.url || ''
    console.log('[local]', req.method, u.split('?')[0], req.headers.origin ? `origin=${req.headers.origin}` : '')
  }

  const u = new URL(req.url || '/', `http://127.0.0.1`)
  const pathname = u.pathname
  const method = req.method || 'GET'

  if (method === 'GET' && pathname === '/') return handleRoot(req, res)
  if (method === 'GET' && pathname === '/health') return handleHealth(req, res)
  if (method === 'GET' && pathname === '/api/health') return handleHealth(req, res)
  if (method === 'GET' && pathname === '/api/gemini/models') return handleModels(req, res)
  if (method === 'GET' && pathname === '/api/chat/welcome') return handleWelcome(req, res)
  if (method === 'POST' && pathname === '/api/chat') return handleChatPost(req, res)
  if (method === 'GET' && (pathname === '/favicon.ico' || pathname === '/favicon.png')) return handleFavicon(req, res)

  sendApiError(
    res,
    buildApiError(
      'NOT_FOUND',
      404,
      'No route matches this URL.',
      `No handler for ${method} ${pathname}`,
      ['Use GET /health, GET /api/chat/welcome, or POST /api/chat.'],
    ),
  )
}

const server = http.createServer((req, res) => {
  dispatch(req, res).catch((err) => {
    console.error(err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain')
      res.end('Internal Server Error')
    }
  })
})

server.listen(PORT, () => {
  console.log(`Backend (Node http) listening on http://localhost:${PORT}`)
  console.log(
    `Chat rate limit: ${CHAT_RATE_LIMIT_MAX} request(s) per ${CHAT_RATE_LIMIT_WINDOW_MS / 1000}s per client (welcome + chat)`,
  )
  if (!getActiveProvider()) {
    if (!isGroqReady() && !isGeminiReady()) {
      console.warn('Warning: No AI provider configured. Set GROQ_API_KEY+GROQ_MODEL and/or GEMINI_API_KEY+GEMINI_MODEL.')
    } else if (!isGroqReady()) {
      console.warn('Warning: Groq is not fully configured (GROQ_API_KEY + GROQ_MODEL). Using Gemini.')
    } else if (!isGeminiReady()) {
      console.warn('Note: Gemini is not configured. Groq is the active provider.')
    }
  } else {
    console.log(`Active AI provider: ${getActiveProvider()}`)
  }
})
