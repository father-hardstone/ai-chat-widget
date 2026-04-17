const { buildApiError, sendApiError } = require('./apiErrors')

/**
 * Fixed-window rate limit: at most `max` requests per `windowMs` per key (default: client IP).
 *
 * @param {{ windowMs: number, max: number, keyGenerator?: (req: import('express').Request) => string }} opts
 */
function createChatRateLimiter(opts) {
  const windowMs = opts.windowMs
  const max = opts.max
  const keyGenerator = opts.keyGenerator ?? ((req) => req.ip || req.socket.remoteAddress || 'unknown')

  /** @type {Map<string, { windowStart: number, count: number }>} */
  const buckets = new Map()

  function prune(now) {
    if (buckets.size < 5000) return
    const cutoff = now - windowMs * 2
    for (const [key, b] of buckets) {
      if (b.windowStart < cutoff) buckets.delete(key)
    }
  }

  return function chatRateLimit(req, res, next) {
    const now = Date.now()
    prune(now)

    const key = keyGenerator(req)
    let b = buckets.get(key)
    if (!b || now - b.windowStart >= windowMs) {
      b = { windowStart: now, count: 0 }
    }

    if (b.count >= max) {
      const retryAfterMs = Math.max(0, b.windowStart + windowMs - now)
      const retryAfterSeconds = Math.max(1, retryAfterMs / 1000)
      sendApiError(
        res,
        buildApiError(
          'CLIENT_RATE_LIMIT',
          429,
          `Too many chat messages. Limit is ${max} per ${Math.round(windowMs / 1000)} seconds.`,
          `This server allows up to ${max} POST /api/chat requests per client every ${Math.round(windowMs / 1000)} seconds. Try again in about ${Math.ceil(retryAfterSeconds)} seconds. This protects your Gemini API quota and keeps usage predictable.`,
          [
            'Wait for the countdown, then send your message again.',
            'To change limits, set CHAT_RATE_LIMIT_MAX and CHAT_RATE_LIMIT_WINDOW_MS in backend/.env (defaults: 3 requests per 60 seconds).',
          ],
          { retryAfterSeconds },
        ),
      )
      return
    }

    b.count += 1
    buckets.set(key, b)
    next()
  }
}

module.exports = { createChatRateLimiter }
