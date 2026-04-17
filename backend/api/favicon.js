'use strict'

const { wrapApi } = require('../src/lib/wrapApi')

module.exports = wrapApi(async (_req, res) => {
  res.statusCode = 204
  res.end()
})
