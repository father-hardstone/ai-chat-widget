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
  const groqKey = process.env.GROQ_API_KEY || ''
  const groqModel = (process.env.GROQ_MODEL || '').trim()
  const geminiKey = process.env.GEMINI_API_KEY || ''
  const geminiModel = (process.env.GEMINI_MODEL || '').trim()
  const { getActiveProvider } = require('../chatProvider')
  const activeProvider = getActiveProvider()
  sendJson(res, 200, {
    ok: true,
    success: true,
    activeProvider,
    groqConfigured: Boolean(groqKey && groqModel),
    groqModel: groqModel || null,
    geminiConfigured: Boolean(geminiKey && geminiModel),
    geminiModelConfigured: Boolean(geminiModel),
    geminiModel: geminiModel || null,
    chatReady: Boolean(activeProvider),
  })
}

module.exports = { handleRoot, handleHealth }
