export type ChatApiErrorPayload = {
  success: false
  error: {
    code: string
    message: string
    detail: string
    hints?: string[]
    requestId?: string
  }
}

export class ChatApiError extends Error {
  readonly code: string
  readonly detail: string
  readonly hints: string[]
  readonly requestId?: string
  readonly httpStatus: number
  /** Seconds until retry (e.g. from Retry-After header). */
  readonly retryAfterSeconds?: number

  constructor(init: {
    code: string
    message: string
    detail: string
    hints?: string[]
    requestId?: string
    httpStatus: number
    retryAfterSeconds?: number
  }) {
    super(init.message)
    this.name = 'ChatApiError'
    this.code = init.code
    this.detail = init.detail
    this.hints = init.hints ?? []
    this.requestId = init.requestId
    this.httpStatus = init.httpStatus
    this.retryAfterSeconds = init.retryAfterSeconds
  }

  /** Short line for toasts (no stack traces; trims provider noise). */
  getToastSummary(): string {
    const base = this.message.trim()
    let extra = this.detail
      .replace(/\[GoogleGenerativeAI Error\]:/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (extra.length > 140) extra = `${extra.slice(0, 137)}…`
    if (!extra || extra.startsWith(base.slice(0, Math.min(20, base.length)))) {
      return base.length > 200 ? `${base.slice(0, 197)}…` : base
    }
    const combined = `${base} ${extra}`
    return combined.length > 280 ? `${combined.slice(0, 277)}…` : combined
  }

  getDisplayText(): string {
    const lines: string[] = [this.message, '', this.detail]
    if (this.hints.length) {
      lines.push('', 'What you can try:', ...this.hints.map((h) => `• ${h}`))
    }
    if (this.requestId) {
      lines.push('', `(Reference: ${this.requestId})`)
    }
    return lines.join('\n')
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

function parseRetryAfterSeconds(res: Response): number | undefined {
  const raw = res.headers.get('Retry-After')
  if (!raw) return undefined
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function parseErrorPayload(
  data: unknown,
  httpStatus: number,
  retryAfterSeconds?: number,
): ChatApiError | null {
  if (!isRecord(data)) return null
  if (data.success !== false) return null
  const err = data.error
  if (!isRecord(err)) return null
  const code = typeof err.code === 'string' ? err.code : 'UNKNOWN'
  const message = typeof err.message === 'string' ? err.message : 'Request failed'
  const detail = typeof err.detail === 'string' ? err.detail : `HTTP ${httpStatus}`
  const hints = Array.isArray(err.hints)
    ? err.hints.filter((h): h is string => typeof h === 'string')
    : []
  const requestId = typeof err.requestId === 'string' ? err.requestId : undefined
  return new ChatApiError({
    code,
    message,
    detail,
    hints,
    requestId,
    httpStatus,
    retryAfterSeconds,
  })
}

export function mapFetchFailure(err: unknown): string {
  if (!(err instanceof TypeError)) {
    return err instanceof Error ? err.message : 'Something went wrong.'
  }
  const m = err.message || ''
  if (/fetch|network|failed to fetch/i.test(m)) {
    return [
      'Could not reach the chat server.',
      '',
      'Usually the backend is not running, CORS is blocking the request, or VITE_API_BASE_URL is wrong.',
      '',
      'What you can try:',
      '• Start the API: cd backend && npm run dev',
      '• Open http://localhost:3001/health — you should see JSON with ok: true',
      '• If the UI calls the API on another origin, set VITE_API_BASE_URL in frontend/.env (see .env.example) and set CLIENT_ORIGIN on the backend to match this Vite URL',
      '• Same-origin dev: leave VITE_API_BASE_URL unset and use the Vite proxy (see vite.config.ts)',
    ].join('\n')
  }
  return m
}

const MAX_HISTORY_TURNS = 4

/** Base URL for the chat API (no trailing slash). Empty = same-origin `/api` (e.g. Vite proxy). */
function getApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL
  if (raw == null || String(raw).trim() === '') return ''
  return String(raw).replace(/\/$/, '')
}

function apiUrl(path: string): string {
  const base = getApiBase()
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}

export async function fetchWelcomeMessage(signal?: AbortSignal): Promise<string> {
  let res: Response
  try {
    res = await fetch(apiUrl('/api/chat/welcome'), { signal })
  } catch (e) {
    throw new Error(mapFetchFailure(e))
  }

  const rawText = await res.text()
  let data: unknown
  try {
    data = rawText ? JSON.parse(rawText) : {}
  } catch {
    throw new ChatApiError({
      code: 'INVALID_RESPONSE',
      message: 'Welcome response was not valid JSON.',
      detail: rawText.slice(0, 200),
      httpStatus: res.status,
    })
  }

  const retryAfter = parseRetryAfterSeconds(res)

  if (!res.ok) {
    const parsed = parseErrorPayload(data, res.status, retryAfter)
    if (parsed) throw parsed
    throw new ChatApiError({
      code: 'WELCOME_FAILED',
      message: 'Could not load the opening message.',
      detail: rawText.slice(0, 300),
      httpStatus: res.status,
    })
  }

  if (isRecord(data) && typeof data.reply === 'string' && data.reply.trim()) {
    return data.reply.trim()
  }

  throw new ChatApiError({
    code: 'INVALID_WELCOME_BODY',
    message: 'Welcome response had no reply.',
    detail: rawText.slice(0, 200),
    httpStatus: res.status,
  })
}

export async function sendChatMessage(input: {
  message: string
  history?: { role: 'user' | 'assistant'; content: string }[]
}): Promise<string> {
  const payload = {
    message: input.message,
    ...(input.history && input.history.length
      ? { history: input.history.slice(-MAX_HISTORY_TURNS) }
      : {}),
  }
  let res: Response
  try {
    res = await fetch(apiUrl('/api/chat'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    throw new Error(mapFetchFailure(e))
  }

  const rawText = await res.text()
  let data: unknown
  try {
    data = rawText ? JSON.parse(rawText) : {}
  } catch {
    throw new ChatApiError({
      code: 'INVALID_RESPONSE',
      message: 'The server returned data that is not valid JSON.',
      detail: `HTTP ${res.status}. Start of body: ${rawText.slice(0, 280)}${rawText.length > 280 ? '…' : ''}`,
      hints: [
        'If using the Vite proxy, run the backend and open the app via the Vite dev URL.',
        'If using VITE_API_BASE_URL, confirm the backend URL and CORS (CLIENT_ORIGIN).',
        'In DevTools → Network, inspect the /api/chat response body.',
      ],
      httpStatus: res.status,
    })
  }

  const retryAfter = parseRetryAfterSeconds(res)

  if (!res.ok) {
    const parsed = parseErrorPayload(data, res.status, retryAfter)
    if (parsed) throw parsed
    const legacy = isRecord(data) && typeof data.error === 'string' ? data.error : null
    throw new ChatApiError({
      code: 'HTTP_ERROR',
      message: 'The chat request failed.',
      detail:
        legacy ||
        (typeof data === 'object' ? JSON.stringify(data).slice(0, 500) : rawText.slice(0, 500)),
      hints: ['Check the backend terminal for logs.', 'Try GET /health on the backend port.'],
      httpStatus: res.status,
      retryAfterSeconds: retryAfter,
    })
  }

  if (isRecord(data) && typeof data.reply === 'string') {
    return data.reply
  }

  throw new ChatApiError({
    code: 'INVALID_SUCCESS_BODY',
    message: 'The server response did not include a reply string.',
    detail: rawText.slice(0, 400),
    hints: ['Confirm backend POST /api/chat returns { "reply": "..." }.'],
    httpStatus: res.status,
  })
}
