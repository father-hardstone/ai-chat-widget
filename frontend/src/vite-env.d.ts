/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full origin of the chat API — required (`frontend/.env`). Injected at build time. */
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
