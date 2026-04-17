'use strict'

const { wrapApi } = require('../src/lib/wrapApi')
const { handleRoot } = require('../src/routes/lightHandlers')

module.exports = wrapApi(handleRoot)
