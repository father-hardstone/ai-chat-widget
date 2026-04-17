'use strict'

const { wrapApi } = require('../../src/lib/wrapApi')
const { handleModels } = require('../../src/chatShared')

module.exports = wrapApi(handleModels)
