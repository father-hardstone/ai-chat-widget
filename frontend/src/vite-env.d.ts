/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Full origin of the chat API (e.g. `http://localhost:3001` or `https://api.example.com`).
   * Omit or leave empty to use same-origin `/api/...` (Vite dev proxy in development).
   */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
