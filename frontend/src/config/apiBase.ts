const MISSING_API_BASE = [
  'VITE_API_BASE_URL is not set.',
  'Copy `frontend/.env.example` to `frontend/.env` and set the full origin of your API (no trailing slash), e.g.',
  '  VITE_API_BASE_URL=http://localhost:3001',
  'For production builds, set the same variable in your host (Vercel, etc.) at build time.',
].join('\n')

/**
 * Base URL of the chat API (scheme + host + port), no trailing slash.
 * Set only via `VITE_API_BASE_URL` in `frontend/.env` or the build environment.
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL
  if (raw == null || String(raw).trim() === '') {
    throw new Error(MISSING_API_BASE)
  }
  return String(raw).replace(/\/$/, '')
}

/** Absolute URL for an API path (e.g. `/api/chat`). */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl()
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}
