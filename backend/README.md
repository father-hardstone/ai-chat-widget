# AI Chat Widget — Backend

Standalone **Express** API for the chat assistant: **Google Gemini**, a JSON **knowledge base**, rate limiting, and structured errors.

- **Long‑running Node**: `npm start` — good for Render, Railway, Fly.io, etc.
- **Serverless (Vercel)**: `api/index.js` wraps the same app with [`serverless-http`](https://github.com/dougmoscrop/serverless-http); `vercel.json` rewrites all paths to that function. Set env vars in the Vercel project (no `.env` file in production).

## Requirements

- Node.js (LTS)
- `GEMINI_API_KEY` and `GEMINI_MODEL` from [Google AI Studio](https://aistudio.google.com/)

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:

- **`GEMINI_API_KEY`** — required.
- **`GEMINI_MODEL`** — required (no default in code). With the server running and the key set, call `GET /api/gemini/models` and copy an `id` into `GEMINI_MODEL`.
- **`CLIENT_ORIGIN`** — browser origin(s) allowed by CORS. Use your frontend URL(s), comma-separated, e.g. `http://localhost:5173,https://your-app.vercel.app`. Defaults to `http://localhost:5173` if unset.
- **`PORT`** — listen port (default `3001`).
- **`CHAT_RATE_LIMIT_MAX`** / **`CHAT_RATE_LIMIT_WINDOW_MS`** — per-IP limits on chat endpoints.
- **`TRUST_PROXY=1`** — if behind a reverse proxy (for correct client IP in rate limiting). On Vercel, `trust proxy` is enabled automatically (`VERCEL` is set).

## Deploy on Vercel (serverless)

1. New Vercel project → import this repo → set **Root Directory** to **`backend`**.
2. **Environment variables**: same as `.env` (`GEMINI_API_KEY`, `GEMINI_MODEL`, `CLIENT_ORIGIN`, etc.). Never commit secrets.
3. Deploy. Your API base is `https://<project>.vercel.app` — use that value for the frontend **`VITE_API_BASE_URL`**.
4. **Rate limiting** uses in-memory state per function instance; under load, limits are approximate (typical for serverless). For strict global limits, use Redis or an edge KV later.

## Run

```bash
npm run dev    # nodemon
npm start      # production
```

## HTTP API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness; Gemini env status |
| `GET` | `/api/gemini/models` | List model ids for `GEMINI_MODEL` |
| `GET` | `/api/chat/welcome` | Opening line for the chat UI |
| `POST` | `/api/chat` | Body: `{ "message": string, "history?"?: ... }` |

## Customizing

- **Facts and prompts**: `knowledge_base.json`, `src/geminiChat.js`
- **Knowledge loading**: `src/knowledgeBase.js`

## Frontend integration

The UI should call this API with a **base URL** set at build time (see the frontend `VITE_API_BASE_URL` and its `.env.example`). Ensure **`CLIENT_ORIGIN`** on the backend matches your deployed frontend origin exactly (scheme + host + port).
