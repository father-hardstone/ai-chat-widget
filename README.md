# AI Chat Widget — Frontend

A **demo** of an embeddable storefront assistant: floating chat bubble, branded panel, and calls to a **separate backend** that answers from a knowledge base plus Google Gemini. The same integration pattern was used to ship a similar assistant **inside a real product**; this app is a standalone, deployable UI (Vite + React + Tailwind).

`backend/` is a **sibling folder** in the repo (not an npm workspace). Run and deploy it independently—see `backend/README.md`.

## What this demo shows

- **Product-style assistant**: The API grounds answers in its knowledge base, not the model alone.
- **Split deployment**: Configure the API base URL with `VITE_API_BASE_URL` so the static site and API can live on different domains.
- **Purpose-built UX**: Welcome line, short history window, loading states, off-topic handling tuned for a retail persona.

## Prerequisites

- Node.js (LTS) and npm
- The backend running locally or deployed (see `backend/README.md`)

## Setup

```bash
cd frontend
npm install
cp .env.example .env
```

### API URL (`frontend/.env`)

**Required:** `VITE_API_BASE_URL` — full origin of the API (no trailing slash). The app does not fall back to relative `/api` URLs or a dev proxy; all requests use this value.

| Scenario | Example |
|----------|---------|
| **Local** | `VITE_API_BASE_URL=http://localhost:3001` (match `PORT` in `backend/.env`). Set backend `CLIENT_ORIGIN=http://localhost:5173` for CORS. |
| **Production** | `VITE_API_BASE_URL=https://api.yourdomain.com`. Set backend `CLIENT_ORIGIN` to your deployed frontend origin, e.g. `https://app.yourdomain.com`. |

Set `VITE_API_BASE_URL` in your static host’s **build** environment (e.g. Vercel) so the bundle points at the live API.

## Run

```bash
npm run dev
```

Open `http://localhost:5173`. Start the backend in another terminal: `cd ../backend && npm run dev`.

## Build

```bash
npm run build
```

Output: `dist/`. Serve with any static host (Vercel, Netlify, S3, etc.). Set **`VITE_API_BASE_URL`** in that host’s environment **at build time** so the bundle points at your API.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production bundle |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint |

## Customizing

- **Branding**: `public/`, widget copy under `src/widgets/chat/`
- **Store facts and model behavior**: edit the backend `knowledge_base.json` and `src/geminiChat.js` (not in this package)

## License

See repository metadata or add a `LICENSE` file if you publish this project.
