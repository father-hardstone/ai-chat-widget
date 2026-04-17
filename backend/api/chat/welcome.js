'use strict'

const { wrapApi } = require('../../src/lib/wrapApi')
const { handleWelcome } = require('../../src/chatShared')

module.exports = wrapApi(handleWelcome)
