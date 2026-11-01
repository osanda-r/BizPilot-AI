# BizPilot AI

A small-business workspace for **classifying customer messages, drafting replies, turning order requests into reviewable tasks, and managing saved work**.

Built with React + TypeScript + Vite, FastAPI, SQLite, and the Groq API through the OpenAI-compatible Python client.

## Run locally

Requirements: **Python 3.11+** and **Node.js 22.12+**.

### 1. Start the API

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
# Windows PowerShell: Copy-Item backend/.env.example backend/.env

cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API works without an API key. Its core tools use explicitly labelled **local English-language rules**, not an AI model.

### 2. Start the frontend

In a second terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open **http://localhost:5173**. Both servers must be running. Vite proxies `/api` and `/health` to the backend, so the browser does not need a hardcoded backend hostname.

In Arena's live preview, use the **BizPilot AI Workspace** preview. The API listens on `0.0.0.0:8000`; Vite listens on `0.0.0.0:5173` and accepts the preview host. Browser requests stay same-origin.

### 3. Optional: enable Groq AI

1. Obtain an API key from [Groq Console](https://console.groq.com/keys).
2. Set `GROQ_API_KEY` in **backend/.env** only. Never use a `VITE_` variable for a secret.
3. If necessary, set `GROQ_MODEL` to a currently available model in your Groq account. The inherited default is `llama-3.3-70b-versatile`.
4. Restart the API and reload the frontend.

`Groq configured` means a key is present; it does **not** mean a paid provider request has been tested. Provider authentication, model availability, and quota depend on your account. The app reports provider errors rather than pretending an AI response succeeded.

## What works

- **Customer inbox:** classify intent, priority, and sentiment; review a summary and suggested action; generate a professional, friendly, or concise reply; edit and copy the draft; save a follow-up task.
- **Order to tasks:** extract an explicit order reference, labelled customer name, and item quantities; review and edit proposed tasks; save only selected tasks. Missing information remains unknown.
- **My tasks:** create manual tasks, set priority and due date, search, filter by status, mark in progress/completed, reopen, and delete with confirmation.
- **Overview:** real task counts and pending work, not fabricated business metrics.
- **AI assistant:** Groq-powered chat with up to 20 previous messages for context. Requires a key; no fake chat responses in local mode.
- **Persistence:** tasks survive browser refreshes and API restarts in `backend/data/bizpilot.db`. Duplicate order-reference/title pairs are skipped atomically.
- **Failure handling:** validation errors, request timeouts, cancellation of stale requests, provider fallback with a visible warning, offline/retry state, and clipboard permission fallback.
- **Responsive UI:** desktop sidebar, mobile navigation, keyboard-accessible controls, self-hosted fonts, and text-safe rendering of customer content.

**Human review is intentional:** the app does not send customer messages, confirm orders, reserve stock, charge payments, or issue refunds. Local rules handle simple English messages and formats such as `2 x Ceramic mug`; use Groq or manual tasks for more complex input. AI output can still be wrong, so check it against the original message.

## Configuration

### Backend: `backend/.env`

| Variable | Default | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | empty | Optional server-side provider key |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq model ID |
| `GROQ_TIMEOUT_SECONDS` | `20` | Provider timeout, between 1 and 120 seconds |
| `DATABASE_PATH` | `backend/data/bizpilot.db` | SQLite path; an explicit relative path is relative to the process working directory |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated origins for a separately hosted frontend |

### Frontend: optional `frontend/.env`

Copy `frontend/.env.example` only if you need to override defaults:

- `VITE_API_URL`: leave empty for the recommended same-origin proxy. Set a public API origin only for a separately hosted API, and add that frontend origin to backend `CORS_ORIGINS`.
- `BACKEND_URL`: server-side Vite proxy target, default `http://127.0.0.1:8000`. This is not browser-facing configuration.

Do not use `localhost` or `127.0.0.1` in browser-facing API URLs for a hosted deployment: those addresses refer to the visitor's device, not the server.

## API

Interactive documentation: **http://localhost:8000/docs**.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | API status, key configuration, storage type |
| POST | `/api/classify` | `{ "message": "…" }` |
| POST | `/api/replies` | `{ "message": "…", "tone": "professional", "business_name": "…" }` |
| POST | `/api/orders/extract` | `{ "message": "…" }`; proposes tasks without saving |
| POST | `/api/chat` | `{ "message": "…", "history": [{ "role": "user", "content": "…" }] }` |
| GET | `/api/tasks` | List saved tasks; optional `?status=todo\|in_progress\|done` |
| POST | `/api/tasks` | `{ "tasks": [{ "title": "…", "description": "…", "priority": "normal", "order_reference": null, "due_date": null }] }` |
| PATCH | `/api/tasks/{id}` | `{ "status": "todo\|in_progress\|done" }` |
| DELETE | `/api/tasks/{id}` | Delete a task |

Message inputs are trimmed and limited to 4,000 characters. Task batches contain 1–50 tasks. Invalid input returns 422, missing tasks return 404, unavailable storage returns 503, and chat without a key returns an actionable 503. Core workflows fall back to rules on provider errors and include `engine: "rules"` plus a warning.

The old `backend/main.py` entry point remains as a compatibility import; the implementation is organized under `backend/app/`.

## Checks

Backend, from the repository root:

```bash
python -m pip install -r backend/requirements-dev.txt
python -m pytest backend/tests -q
.venv/bin/ruff check backend
.venv/bin/ruff format --check backend
```

Frontend:

```bash
cd frontend
npm ci
npm run lint
npm test
npm run build
npm audit --audit-level=moderate
```

With both development servers running, run the real-browser workflow and accessibility checks:

```bash
cd frontend
npx playwright install chromium
npm run test:browser
# Existing browser: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium npm run test:browser
```

The browser test creates temporary tasks and removes only those records afterward. Use a development/test database, not production data. GitHub Actions runs backend, frontend, build, dependency, browser, and accessibility checks without a Groq key. Provider tests use mocked HTTP responses; a real Groq account is needed to verify live AI generation.

## Production boundary

This is a **single-workspace application without authentication**. Keep it local or behind authenticated access controls before exposing customer data or task mutation endpoints publicly. SQLite is suitable for a small single-instance deployment; use a shared database and add authorization, rate limiting, and a retention policy for a multi-user service.

For a production frontend, run `npm run build` and serve `frontend/dist` behind a reverse proxy that forwards `/api` and `/health` to FastAPI. `npm run preview` is a local production-build preview, not a production server. Serve over HTTPS outside localhost.

Customer text is not stored by the app unless you save it in a task. AI requests send the submitted text, and chat sends recent conversation context, to Groq. Do not submit sensitive information unnecessarily. Secrets and SQLite data are excluded from Git.
