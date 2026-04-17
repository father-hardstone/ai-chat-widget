'use strict'

/**
 * Vercel Serverless Function: standard Node adapter for the Express app.
 * @see https://github.com/dougmoscrop/serverless-http
 */
const serverless = require('serverless-http')
const app = require('../src/app')

module.exports = serverless(app)
