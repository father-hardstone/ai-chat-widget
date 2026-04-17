'use strict'

/**
 * Vercel serverless entry. Health + favicons return immediately without loading Express
 * (avoids cold-start importing @google/generative-ai and the full app for GET /health).
 * @see https://github.com/dougmoscrop/serverless-http
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const serverless = require('serverless-http')

/** @type {ReturnType<typeof serverless> | null} */
let cachedExpressHandler = null

function requestPath(req) {
  const fromHeader =
    req.headers['x-vercel-forwarded-path'] ||
    req.headers['x-vercel-original-path'] ||
    req.headers['x-invoke-path'] ||
    req.headers['x-matched-path']
  if (typeof fromHeader === 'string' && fromHeader.startsWith('/')) {
    return fromHeader.split('?')[0] || '/'
  }
  const u = req.url || '/'
  return u.split('?')[0] || '/'
}

function logRequest(req, p) {
  const origin = req.headers.origin || ''
  const fwd = req.headers['x-forwarded-for']
  const ip = typeof fwd === 'string' ? fwd.split(',')[0].trim() : ''
  console.log(`[api] ${req.method} ${p} origin=${origin || '(same-origin or direct)'} ${ip ? `ip=${ip}` : ''}`)
}

function sendHealthJson(res) {
  const key = process.env.GEMINI_API_KEY || ''
  const model = (process.env.GEMINI_MODEL || '').trim()
  res.setHeader('Cache-Control', 'no-store, no-cache')
  res.status(200).json({
    ok: true,
    success: true,
    geminiConfigured: Boolean(key),
    geminiModelConfigured: Boolean(model),
    geminiModel: model || null,
    chatReady: Boolean(key && model),
    /** Confirms this response did not load the Express stack (fast path). */
    fastPath: true,
  })
}

module.exports = (req, res) => {
  const p = requestPath(req)
  logRequest(req, p)

  if (p === '/health' || p === '/api/health') {
    sendHealthJson(res)
    return
  }

  if (p === '/favicon.ico' || p === '/favicon.png') {
    res.status(204).end()
    return
  }

  if (p === '/') {
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({
      success: true,
      service: 'ai-chat-widget-api',
      message: 'Chat API is running. Use GET /health, GET /api/chat/welcome, or POST /api/chat.',
      fastPath: true,
    })
    return
  }

  if (!cachedExpressHandler) {
    const app = require('../src/app')
    cachedExpressHandler = serverless(app)
  }
  return cachedExpressHandler(req, res)
}
