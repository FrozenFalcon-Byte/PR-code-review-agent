# PR Code Review Agent

An autonomous GitHub pull request review tool powered by LangChain and a choice of LLM providers. Paste a PR URL, hit Analyze, and get a structured review of bugs, security issues, and suggestions — plus merge conflict analysis, a copy-pasteable AI prompt, and streaming code fix generation.

![Tech Stack](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-blue) ![Backend](https://img.shields.io/badge/Backend-FastAPI-green) ![LLM](https://img.shields.io/badge/LLM-LangChain-orange)

---

## Features

- **Autonomous code review** — the agent iteratively fetches file contents, function definitions, and searches the repo before producing a structured JSON review with bugs, security issues, and suggestions
- **Merge conflict analysis** — fetches both sides of every changed file and explains what each side does, why they conflict, and how to resolve them
- **AI prompt tab** — auto-generated copy-pasteable prompt (with full diff + all findings) you can paste into Claude, ChatGPT, or Gemini
- **Streaming code generation** — one-click "Generate Code Fixes" streams unified-diff patches from the LLM directly into a Mac-style code window with per-line diff coloring
- **Recent reviews** — localStorage-backed history of your last 5 reviews, shown on the home page
- **Multi-provider LLM support** — Gemini, Groq, OpenRouter, Ollama (local), or Cerebras
- **SSE streaming** — review logs stream live to the frontend so you can watch the agent work in real time
- **Parallel analysis** — code review and conflict analysis run in parallel threads for faster results

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              React Frontend (Vite)           │
│                                             │
│  HeroSection   AnalyzeSection   ResultTabs  │
│  RecentReviews                              │
│     ├── ReviewTab   (bugs / security / sug) │
│     ├── ConflictTab (per-file conflict info) │
│     └── PromptTab   (AI prompt + code gen)  │
└──────────────────┬──────────────────────────┘
                   │ HTTP / SSE
┌──────────────────▼──────────────────────────┐
│              FastAPI Backend                 │
│                                             │
│  /review/stream   → SSE log + result        │
│  /review/full     → parallel review+conflict│
│  /review/conflicts→ conflict analysis only  │
│  /review/generate-code → SSE code stream    │
└──────────────────┬──────────────────────────┘
                   │ LangChain
┌──────────────────▼──────────────────────────┐
│         LLM Provider (your choice)           │
│   Gemini · Groq · OpenRouter · Ollama        │
│   Cerebras                                   │
└─────────────────────────────────────────────┘
```

### Key files

| Path | Purpose |
|------|---------|
| `backend/agent.py` | Core agent loop, conflict analyzer, prompt builder, streaming code gen |
| `backend/server.py` | FastAPI routes, SSE streaming, parallel ThreadPoolExecutor jobs |
| `backend/tools.py` | Pydantic output models (`ReviewOutput`, `ConflictReport`) + tool dispatch |
| `backend/github.py` | GitHub API helpers (diff, metadata, file content, PR files) |
| `frontend/src/App.tsx` | Root state, review orchestration, localStorage save |
| `frontend/src/api.ts` | All HTTP/SSE client functions |
| `frontend/src/components/tabs/PromptTab.tsx` | AI prompt display, code generation, Mac diff window |
| `frontend/src/components/tabs/ConflictTab.tsx` | Conflict display with word-wrapped side-by-side cards |
| `frontend/src/components/RecentReviews.tsx` | localStorage-backed recent history component |

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A GitHub account (optionally a personal access token for higher API rate limits)
- An API key for at least one supported LLM provider

### 1. Clone

```bash
git clone https://github.com/FrozenFalcon-Byte/PR-code-review-agent.git
cd PR-code-review-agent
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Copy the example env file and fill in your keys:

```bash
cp ../.env.example ../.env
```

Edit `.env` and set `MODEL_PROVIDER` plus the corresponding API key (see [Provider Setup](#provider-setup) below).

Start the API server:

```bash
uvicorn server:app --reload --port 8000
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Provider Setup

Set `MODEL_PROVIDER` in `.env` to one of the values below, then add the matching key.

| Provider | `MODEL_PROVIDER` | Env var | Notes |
|----------|-----------------|---------|-------|
| **OpenRouter** | `openrouter` | `OPENROUTER_API_KEY` | Free models available; `meta-llama/llama-3.3-70b-instruct:free` recommended |
| **Gemini** | `gemini` | `GOOGLE_API_KEY` | `gemini-2.0-flash` by default |
| **Groq** | `groq` | `GROQ_API_KEY` | `llama-3.3-70b-versatile` by default |
| **Ollama** | `ollama` | — | Run `ollama pull llama3.2` first; set `OLLAMA_MODEL` |
| **Cerebras** | `cerebras` | `CEREBRAS_API_KEY` | Free tier: 30 RPM, 1 M tokens/day |

Get keys at:
- OpenRouter: https://openrouter.ai/keys
- Gemini: https://aistudio.google.com/apikey
- Groq: https://console.groq.com/keys
- Cerebras: https://cloud.cerebras.ai

### Optional: GitHub token

Without a token the GitHub API allows ~60 requests/hour. With one it's 5,000/hour. Set `GITHUB_TOKEN` in `.env` with a classic token that has `repo:read` scope.

---

## API Reference

All endpoints are at `http://localhost:8000`.

### `POST /review/stream` *(recommended)*
Streams review logs as SSE then delivers the full result. Used by the frontend.

**Request body:**
```json
{ "pr_url": "https://github.com/owner/repo/pull/123", "max_iterations": 10 }
```

**SSE events:**
- `event: log` — agent progress message
- `event: result` — JSON payload `{ review, conflicts, agent_prompt }`
- `event: error` — error string

### `POST /review/full`
Synchronous version of the above. Returns the same JSON payload when complete.

### `POST /review`
Code review only (no conflict analysis, no prompt).

### `POST /review/conflicts`
Conflict analysis only.

### `POST /review/with-prompt`
Code review + generated AI prompt.

### `POST /review/generate-code`
Accepts the AI prompt and streams code fix chunks as SSE.

**Request body:**
```json
{ "prompt": "<the agent prompt string>" }
```

**SSE events:**
- `event: chunk` — text delta (JSON string)
- `event: done` — stream finished

### `GET /health`
Returns `{ "status": "ok" }`.

---

## How It Works

### Code Review Agent
1. Fetches the PR diff and metadata from the GitHub API
2. Sends the diff to the LLM with a set of tools (`get_file_content`, `get_function_definition`, `search_repo`)
3. The LLM iteratively calls tools to read relevant files (up to `max_iterations` rounds)
4. Once enough context is gathered, a final structured-output call produces a `ReviewOutput` with bugs, security issues, suggestions, and a summary

### Conflict Analysis
Runs in parallel with the code review. Fetches both sides of every changed file (base branch + PR head) and asks the LLM to explain what each side does, why they conflict, and how to resolve them.

### AI Prompt + Code Generation
After the review, a self-contained prompt is built (no extra LLM call) that includes the full diff, all findings, and explicit unified-diff output instructions. You can:
- Copy it and paste into Claude, ChatGPT, or Gemini
- Click "Generate Code Fixes" to stream the LLM response directly into the Mac-style diff window in the app

---

## Development

### Type check (frontend)
```bash
cd frontend && npx tsc --noEmit
```

### Build frontend for production
```bash
cd frontend && npm run build
```

The built files land in `frontend/dist/` and can be served by any static file host.

### Run backend in production mode
```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MODEL_PROVIDER` | Yes | `gemini` | LLM provider to use |
| `OPENROUTER_API_KEY` | If using OpenRouter | — | OpenRouter API key |
| `OPENROUTER_MODEL` | No | `meta-llama/llama-3.3-70b-instruct:free` | Model name on OpenRouter |
| `GOOGLE_API_KEY` | If using Gemini | — | Google AI Studio key |
| `GROQ_API_KEY` | If using Groq | — | Groq API key |
| `OLLAMA_MODEL` | No | `llama3.2` | Ollama model name |
| `CEREBRAS_API_KEY` | If using Cerebras | — | Cerebras API key |
| `CEREBRAS_MODEL` | No | `llama3.3-70b` | Cerebras model name |
| `GITHUB_TOKEN` | No | — | GitHub PAT for higher rate limits |

---

## License

MIT
