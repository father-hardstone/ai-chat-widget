/**
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {unknown} obj
 */
function sendJson(res, status, obj) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(obj))
}

module.exports = { sendJson }
