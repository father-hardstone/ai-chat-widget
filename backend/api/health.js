'use strict'

const { wrapApi } = require('../src/lib/wrapApi')
const { handleHealth } = require('../src/routes/lightHandlers')

module.exports = wrapApi(handleHealth)
