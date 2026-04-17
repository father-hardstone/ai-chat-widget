const crypto = require('crypto')

const {
  GoogleGenerativeAIAbortError,
  GoogleGenerativeAIError,
  GoogleGenerativeAIFetchError,
  GoogleGenerativeAIRequestInputError,
  GoogleGenerativeAIResponseError,
} = require('@google/generative-ai')

/**
 * @typedef {Object} ApiErrorBody
 * @property {false} success
 * @property {{ code: string, message: string, detail: string, hints?: string[], requestId: string }} error
 */

/**
 * @param {string} code
 * @param {number} httpStatus
 * @param {string} message
 * @param {string} detail
 * @param {string[]=} hints
 * @param {{ retryAfterSeconds?: number }=} meta
 * @returns {ApiErrorBody & { httpStatus: number, retryAfterSeconds?: number }}
 */
function buildApiError(code, httpStatus, message, detail, hints, meta) {
  const retryAfterSeconds =
    meta && typeof meta.retryAfterSeconds === 'number' ? meta.retryAfterSeconds : undefined
  return {
    success: false,
    error: {
      code,
      message,
      detail,
      ...(hints && hints.length ? { hints } : {}),
      requestId: crypto.randomUUID(),
    },
    httpStatus,
    ...(retryAfterSeconds != null ? { retryAfterSeconds } : {}),
  }
}

/**
 * @param {import('express').Response | import('http').ServerResponse} res
 * @param {ApiErrorBody & { httpStatus: number, retryAfterSeconds?: number }} payload
 */
function sendApiError(res, payload) {
  const { httpStatus, retryAfterSeconds, ...body } = payload
  if (retryAfterSeconds != null) {
    const ra = String(Math.max(1, Math.ceil(retryAfterSeconds)))
    if (typeof res.set === 'function') {
      res.set('Retry-After', ra)
    } else {
      res.setHeader('Retry-After', ra)
    }
  }
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(httpStatus).json(body)
    return
  }
  res.statusCode = httpStatus
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function safeJson(value, maxLen = 1200) {
  try {
    const s = JSON.stringify(value)
    if (s.length <= maxLen) return s
    return `${s.slice(0, maxLen)}…`
  } catch {
    return String(value)
  }
}

/**
 * Summarize Google API errorDetails (if present) without dumping secrets.
 * @param {unknown} details
 */
function summarizeGoogleErrorDetails(details) {
  if (details == null) return ''
  if (typeof details === 'string') return details
  return safeJson(details, 800)
}

/**
 * @param {unknown} err
 * @param {{ modelName: string }} ctx
 * @returns {ApiErrorBody & { httpStatus: number }}
 */
function mapGeminiError(err, ctx) {
  const model = ctx.modelName || '(unknown model)'

  if (err instanceof GoogleGenerativeAIFetchError) {
    const status = err.status
    const upstream = summarizeGoogleErrorDetails(err.errorDetails)
    const technical = [err.message, err.statusText ? `(${err.statusText})` : null, upstream || null]
      .filter(Boolean)
      .join(' ')

    if (status === 401 || status === 403) {
      return buildApiError(
        'GEMINI_AUTH',
        502,
        'The AI service rejected your API key.',
        `Google returned HTTP ${status}. This usually means the key is missing, revoked, or not allowed for the Generative Language API. Your message was not processed.${upstream ? ` Additional detail from the provider: ${upstream}` : ''}`,
        [
          'Confirm `GEMINI_API_KEY` in `backend/.env` matches a key from Google AI Studio and has not been rotated.',
          'Ensure the Generative Language API is enabled for the Google Cloud project tied to the key (if you are using a Cloud key).',
          'Restart the backend after changing `.env` so the new key is loaded.',
        ],
      )
    }

    if (status === 404) {
      const deprecatedForNewUsers =
        /no longer available to new users/i.test(technical) ||
        /no longer available/i.test(technical)

      const hints = []
      if (deprecatedForNewUsers) {
        hints.push(
          'Google says this model id is retired or not offered to new API users. Set `GEMINI_MODEL` in `backend/.env` to a different `id` from GET /api/gemini/models.',
        )
      }
      hints.push(
        'Call GET /api/gemini/models on your backend (port 3001) to list `id` values your key can use with generateContent—copy one exactly into GEMINI_MODEL.',
        'See https://ai.google.dev/gemini-api/docs/models for documentation.',
      )

      return buildApiError(
        'GEMINI_MODEL_NOT_FOUND',
        502,
        'The configured Gemini model could not be found.',
        `The server requested model "${model}" but Google responded with 404. ${technical}`,
        hints,
      )
    }

    if (status === 429) {
      const t = technical.toLowerCase()
      const freeTierExhausted =
        t.includes('free_tier') ||
        t.includes('limit: 0') ||
        /quota exceeded/i.test(technical)

      const hints = []
      if (freeTierExhausted) {
        hints.push(
          'Google reports your free-tier quota for this model is exhausted (look for "free_tier" or "limit: 0" in the error). Billing or a different model/plan may be required.',
          'In Google AI Studio, review usage, billing, and rate limits: https://ai.google.dev/gemini-api/docs/rate-limits',
          'Try setting GEMINI_MODEL to another id from GET /api/gemini/models that your account still has quota for.',
        )
      }
      hints.push(
        'Wait for the retry delay Google suggests (if any), then try again.',
        'This app also enforces its own per-minute limit on /api/chat to reduce accidental quota burn.',
      )

      return buildApiError(
        'GEMINI_RATE_LIMIT',
        429,
        'The AI service is rate-limiting requests right now.',
        `Google returned HTTP 429 (too many requests). ${technical}`,
        hints,
      )
    }

    if (status === 400) {
      return buildApiError(
        'GEMINI_BAD_REQUEST',
        502,
        'The AI service could not accept this request.',
        `Google returned HTTP 400. This often indicates an invalid parameter, payload size issue, or an unsupported combination of options. ${technical}`,
        [
          'Try a shorter message to rule out size limits.',
          `Verify \`GEMINI_MODEL\` is valid. Current value: "${model}".`,
        ],
      )
    }

    if (status >= 500) {
      return buildApiError(
        'GEMINI_UPSTREAM',
        502,
        'The AI service is temporarily unavailable.',
        `Google returned HTTP ${status}. This is usually a transient issue on the provider side. ${technical}`,
        ['Wait a moment and try again.', 'Check Google AI / Gemini status if failures persist.'],
      )
    }

    return buildApiError(
      'GEMINI_HTTP_ERROR',
      502,
      'The AI service returned an unexpected error.',
      `HTTP ${status}. ${technical}`,
      ['Retry in a few seconds.', 'If this continues, inspect backend logs for the full provider message.'],
    )
  }

  if (err instanceof GoogleGenerativeAIResponseError) {
    const r = err.response
    const blockHint =
      r?.promptFeedback?.blockReasonMessage ||
      r?.candidates?.[0]?.finishMessage ||
      ''
    return buildApiError(
      'GEMINI_RESPONSE_BLOCKED',
      502,
      'The model could not return a normal text answer for this input.',
      `${err.message}${blockHint ? ` Context: ${blockHint}` : ''}`,
      [
        'Rephrase your question more neutrally and try again.',
        'Remove content that might trigger safety filters if applicable.',
      ],
    )
  }

  if (err instanceof GoogleGenerativeAIRequestInputError) {
    return buildApiError(
      'GEMINI_INVALID_INPUT',
      500,
      'Invalid request to the AI client.',
      err.message,
      ['This is unexpected for normal chat traffic; check backend logs and dependency versions.'],
    )
  }

  if (err instanceof GoogleGenerativeAIAbortError) {
    return buildApiError(
      'GEMINI_ABORTED',
      504,
      'The AI request was aborted or timed out.',
      err.message,
      ['Check your network connection.', 'Try again with a shorter message.'],
    )
  }

  if (err instanceof GoogleGenerativeAIError) {
    return buildApiError(
      'GEMINI_CLIENT_ERROR',
      502,
      'The AI client reported an error.',
      err.message,
      ['Retry shortly.', 'If it persists, verify API key and model settings.'],
    )
  }

  if (err instanceof Error) {
    const msg = err.message || 'Unknown error'
    if (/timed out after \d+ms/i.test(msg)) {
      return buildApiError(
        'GEMINI_TIMEOUT',
        504,
        'The AI request took too long and was stopped.',
        msg,
        [
          'Retry once; transient slowness happens.',
          'Adjust `GEMINI_REQUEST_TIMEOUT_MS` (default 45000) if your host allows longer runs.',
          'On Vercel, ensure `GEMINI_API_KEY` and `GEMINI_MODEL` are set and the model is reachable from your region.',
        ],
      )
    }
    if (/empty response/i.test(msg)) {
      return buildApiError(
        'GEMINI_EMPTY_REPLY',
        502,
        'The model returned no usable text.',
        'The response was empty after generation. This can happen with certain safety outcomes or provider glitches.',
        ['Try rephrasing your question.', 'Retry once; if it keeps happening, try another `GEMINI_MODEL`.'],
      )
    }
    return buildApiError(
      'INTERNAL_ERROR',
      500,
      'Something went wrong while processing your message.',
      msg,
      ['Check backend logs for the stack trace.', 'Confirm the backend and Gemini integration are configured correctly.'],
    )
  }

  return buildApiError(
    'UNKNOWN_ERROR',
    500,
    'An unexpected error occurred.',
    safeJson(err),
    ['Check backend logs.', 'Retry the request.'],
  )
}

/**
 * @param {unknown} err
 * @returns {ApiErrorBody & { httpStatus: number } | null}
 */
function mapKnowledgeBaseError(err) {
  if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
    return buildApiError(
      'KNOWLEDGE_BASE_MISSING',
      500,
      'The knowledge base file is missing.',
      'Expected `backend/knowledge_base.json` next to the backend app. The server cannot ground answers without it.',
      ['Restore `knowledge_base.json` or fix the path in `backend/src/knowledgeBase.js`.'],
    )
  }
  if (err && typeof err === 'object' && 'code' in err && err.code === 'EACCES') {
    return buildApiError(
      'KNOWLEDGE_BASE_UNREADABLE',
      500,
      'The knowledge base file could not be read.',
      'The process does not have permission to read `backend/knowledge_base.json`.',
      ['Fix file permissions or run the backend from a user that can read the file.'],
    )
  }
  if (err instanceof SyntaxError) {
    return buildApiError(
      'KNOWLEDGE_BASE_INVALID_JSON',
      500,
      'The knowledge base file is not valid JSON.',
      `JSON parse failed: ${err.message}. Fix the syntax in knowledge_base.json.`,
      ['Open the file in an editor with JSON validation.', 'Validate the file with a JSON linter.'],
    )
  }
  if (err instanceof Error && err.message.includes('must be a JSON array')) {
    return buildApiError(
      'KNOWLEDGE_BASE_WRONG_SHAPE',
      500,
      'The knowledge base has the wrong structure.',
      err.message,
      ['Ensure the root of knowledge_base.json is an array of Q&A objects.'],
    )
  }
  return null
}

/**
 * @param {unknown} err
 * @param {import('express').Request} req
 * @returns {ApiErrorBody & { httpStatus: number } | null}
 */
function mapBodyParserError(err, req) {
  const anyErr = err
  const pathHint = (req.path || (typeof req.url === 'string' ? req.url : '') || '').split('?')[0]
  if (anyErr && anyErr.type === 'entity.too.large') {
    return buildApiError(
      'PAYLOAD_TOO_LARGE',
      413,
      'Request body is too large.',
      'The JSON body exceeded the size limit.',
      ['Send a shorter message.', `Method was ${req.method} ${pathHint}.`],
    )
  }
  if (anyErr && anyErr.type === 'entity.parse.failed') {
    return buildApiError(
      'INVALID_JSON_BODY',
      400,
      'The request body is not valid JSON.',
      'The client sent malformed JSON in the POST body. Chat messages must be JSON like {"message":"..."}.',
      ['Ensure the frontend sends Content-Type: application/json and valid JSON.', `Method was ${req.method} ${pathHint}.`],
    )
  }
  return null
}

module.exports = {
  buildApiError,
  sendApiError,
  mapGeminiError,
  mapKnowledgeBaseError,
  mapBodyParserError,
}
