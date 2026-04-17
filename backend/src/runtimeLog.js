/**
 * Structured stdout logs for Vercel Runtime Logs (and local). ISO timestamps + scope
 * make it obvious where time is spent before a 504 / timeout.
 *
 * @param {string} scope
 * @param {string} message
 * @param {Record<string, unknown>} [extra]
 */
function runtimeLog(scope, message, extra) {
  const ts = new Date().toISOString()
  if (extra && typeof extra === 'object' && Object.keys(extra).length > 0) {
    console.log(`[${ts}] [${scope}] ${message}`, extra)
  } else {
    console.log(`[${ts}] [${scope}] ${message}`)
  }
}

/**
 * @param {string} scope
 * @param {string} message
 * @param {Record<string, unknown> | Error | unknown} [extra]
 */
function runtimeError(scope, message, extra) {
  const ts = new Date().toISOString()
  if (extra instanceof Error) {
    console.error(`[${ts}] [${scope}] ${message}`, extra.message)
  } else if (extra && typeof extra === 'object' && Object.keys(extra).length > 0) {
    console.error(`[${ts}] [${scope}] ${message}`, extra)
  } else {
    console.error(`[${ts}] [${scope}] ${message}`)
  }
}

module.exports = { runtimeLog, runtimeError }
