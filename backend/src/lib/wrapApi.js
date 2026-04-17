require('./loadEnv')

const { applyCors, handlePreflight } = require('./httpCors')
const { augmentRequest } = require('./httpRequest')
const { buildApiError, sendApiError, mapBodyParserError } = require('../apiErrors')

/**
 * Vercel / local: CORS + OPTIONS + JSON error wrapper.
 * @param {(req: import('http').IncomingMessage, res: import('http').ServerResponse) => void | Promise<void>} handler
 */
function wrapApi(handler) {
  return async (req, res) => {
    augmentRequest(req)
    applyCors(req, res)
    if (handlePreflight(req, res)) return

    if (process.env.LOG_REQUESTS !== '0') {
      const u = req.url || ''
      console.log('[api]', req.method, u.split('?')[0], req.headers.origin ? `origin=${req.headers.origin}` : '')
    }

    try {
      await handler(req, res)
    } catch (e) {
      const parsed = mapBodyParserError(e, req)
      if (parsed) {
        sendApiError(res, parsed)
        return
      }
      console.error('[api] unhandled', e)
      sendApiError(
        res,
        buildApiError(
          'INTERNAL_ERROR',
          500,
          'Something went wrong on the server.',
          e instanceof Error ? e.message : 'Unknown error.',
          ['Check backend logs.'],
        ),
      )
    }
  }
}

module.exports = { wrapApi }
