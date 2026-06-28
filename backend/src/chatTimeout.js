const { runtimeError } = require('./runtimeLog')

/** Abort long AI calls so serverless (e.g. Vercel) returns a JSON error instead of a 504. */
function chatRequestTimeoutMs() {
  const raw =
    process.env.CHAT_REQUEST_TIMEOUT_MS ??
    process.env.GEMINI_REQUEST_TIMEOUT_MS ??
    process.env.GROQ_REQUEST_TIMEOUT_MS
  const n = raw != null && String(raw).trim() !== '' ? Number(raw) : 45_000
  return Number.isFinite(n) && n >= 5000 && n <= 120_000 ? Math.floor(n) : 45_000
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label
 * @param {string} logTag
 * @param {string} timeoutHint
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, label, logTag, timeoutHint) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      runtimeError(logTag, `TIMEOUT: ${label}`, { ms, hint: timeoutHint })
      reject(new Error(`${label} timed out after ${ms}ms`))
    }, ms)
    promise.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

module.exports = { chatRequestTimeoutMs, withTimeout }
