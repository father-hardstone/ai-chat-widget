function allowedOriginsList() {
  const fallback = ['http://localhost:5173']
  const s = (process.env.CLIENT_ORIGIN ?? '').trim()
  if (!s) return fallback
  const list = s.split(',').map((x) => x.trim()).filter(Boolean)
  return list.length ? list : fallback
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
function applyCors(req, res) {
  const origin = req.headers.origin
  const allowed = allowedOriginsList()
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else if (origin) {
    console.warn(
      '[cors] blocked Origin:',
      origin,
      '| Add to CLIENT_ORIGIN. Allowed:',
      allowed,
    )
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
}

/** @returns {boolean} true if OPTIONS was handled */
function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return true
  }
  return false
}

module.exports = { allowedOriginsList, applyCors, handlePreflight }
