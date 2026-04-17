'use strict'

const { wrapApi } = require('../../src/lib/wrapApi')
const { sendJson } = require('../../src/lib/httpJson')
const { handleChatPost } = require('../../src/chatShared')

module.exports = wrapApi(async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, {
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Use POST for /api/chat',
        detail: `Got ${req.method}`,
      },
    })
    return
  }
  await handleChatPost(req, res)
})
