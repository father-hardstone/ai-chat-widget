/** Express-compatible req.ip for rate limiting */
function augmentRequest(req) {
  const fwd = req.headers['x-forwarded-for']
  req.ip =
    typeof fwd === 'string'
      ? fwd.split(',')[0].trim()
      : /** @type {import('net').Socket} */ (req.socket)?.remoteAddress || ''
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {number} [limit]
 */
async function readJsonBody(req, limit = 1_000_000) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > limit) {
      throw Object.assign(new Error('Payload too large'), { type: 'entity.too.large' })
    }
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim()) return {}
  try {
    return JSON.parse(raw)
  } catch (e) {
    if (e instanceof SyntaxError) {
      const err = new Error('invalid json')
      err.type = 'entity.parse.failed'
      throw err
    }
    throw e
  }
}

module.exports = { augmentRequest, readJsonBody }
