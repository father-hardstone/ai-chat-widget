const app = require('./app')

const PORT = Number(process.env.PORT ?? 3001)

const rawRateMax = Number(process.env.CHAT_RATE_LIMIT_MAX)
const CHAT_RATE_LIMIT_MAX =
  Number.isFinite(rawRateMax) && rawRateMax >= 1 ? Math.floor(rawRateMax) : 3
const rawRateWindow = Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS)
const CHAT_RATE_LIMIT_WINDOW_MS =
  Number.isFinite(rawRateWindow) && rawRateWindow >= 1000
    ? Math.floor(rawRateWindow)
    : 60_000

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`)
  console.log(
    `Chat rate limit: ${CHAT_RATE_LIMIT_MAX} request(s) per ${CHAT_RATE_LIMIT_WINDOW_MS / 1000}s per client (GET /api/chat/welcome, POST /api/chat)`,
  )
  if (!process.env.GEMINI_API_KEY) {
    console.warn(
      'Warning: GEMINI_API_KEY is not set. Chat will return 503 until backend/.env is configured.',
    )
  } else if (!process.env.GEMINI_MODEL) {
    console.warn(
      'Warning: GEMINI_MODEL is not set. Chat will return 503 until you set a model id in backend/.env (see GET /api/gemini/models).',
    )
  }
})
