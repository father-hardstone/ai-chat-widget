require('../lib/loadEnv')
const { sendJson } = require('../lib/httpJson')

async function handleRoot(_req, res) {
  sendJson(res, 200, {
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
}

async function handleHealth(_req, res) {
  const key = process.env.GEMINI_API_KEY || ''
  const model = (process.env.GEMINI_MODEL || '').trim()
  sendJson(res, 200, {
    ok: true,
    success: true,
    geminiConfigured: Boolean(key),
    geminiModelConfigured: Boolean(model),
    geminiModel: model || null,
    chatReady: Boolean(key && model),
  })
}

module.exports = { handleRoot, handleHealth }
