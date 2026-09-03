# Company Research Tool

## About the project

A sales-research tool that accepts a company name and streams a structured
briefing with an overview, key people, recent news, financial highlights, and
risk factors. Reports are saved in SQLite and can be reopened from history.

When API keys are absent, the app runs in mock mode with clearly labeled sample
data. Enter `Microsoft` (or any company name) to see every report field
populated in the UI.

The stack is React and TypeScript with Vite on the frontend, FastAPI with
Python 3.12 on the backend, Pydantic for validation, SQLAlchemy with SQLite
for persistence, and pytest plus Vitest for testing.

## Problems solved

The main problems I solved were keeping the report shape consistent, showing
sections as they became available, and making the project usable without paid
API access. I used a Pydantic report schema and Anthropic tool use to validate
the LLM response instead of parsing free-form text. The FastAPI backend then
streams each completed section over SSE, while the React frontend ignores late
events from an older search. A SQLite service keeps completed reports available
in history. For local development, mock search and mock LLM services return a
complete labeled sample report, so missing keys do not leave the UI full of
empty fields.

## How I used Claude during development

I used Claude as a development partner rather than treating it as a
replacement for engineering judgment. I first provided the product
requirements and asked it to break the work into a small backend, frontend,
data-contract, and testing plan. I then used focused prompts to generate and
refine individual pieces, such as the Pydantic models, FastAPI routes, SSE
event handling, React state transitions, and mock services.

The most effective workflow was iterative: I ran the application and tests,
shared the actual errors or behavior with Claude, and asked for a root-cause
fix instead of accepting a broad rewrite. Claude helped identify edge cases
such as malformed LLM output, missing API keys, duplicate searches, stale SSE
responses, and incomplete mock data. I reviewed the suggested changes against
the requirements, kept the public data contract stable, and verified the
result with pytest, Vitest, and a production frontend build.

This approach helped me move quickly while still making the important design
decisions myself: choosing FastAPI and SSE, defining the report schema,
keeping mock data clearly labeled, and deciding which trade-offs were suitable
for a small interview project.

## How to install and run

Requirements: Node.js 18+ and Python 3.12.

From the repository root, open two terminals.

Terminal 1, backend:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

Terminal 2, frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`, enter `Microsoft`, and select **Research**.

## Which LLM, backend, and search API, and why

- **Backend:** FastAPI was chosen for a small, typed Python API and its support
  for streaming responses. The research pipeline validates the name, gathers
  search context, generates the report, streams the sections, and saves the
  result.
- **LLM:** Anthropic Claude (`claude-sonnet-4-5`) because tool use lets the
  backend request structured output matching the report schema.
- **Search:** Google Custom Search JSON API because it provides supported,
  programmatic Google web search without scraping search-result pages.

## API key configuration

Copy `backend/.env.example` to `backend/.env` and set:

```dotenv
LLM_API_KEY=your_anthropic_key
SEARCH_API_KEY=your_google_key
SEARCH_ENGINE_ID=your_google_search_engine_id
```

Leave these values blank to use mock mode. Never commit `.env` or API keys.
The frontend defaults to `http://localhost:8000`; override it with
`VITE_API_BASE_URL` in `frontend/.env` if needed.

## Trade-offs

- The LLM generates one complete structured report, then the backend streams
  its five sections progressively. This is cheaper and more consistent than
  five separate LLM calls, but section streaming is presentation-level rather
  than token-level.
- SQLite and an in-memory duplicate-request guard keep local setup simple, but
  are not intended for multi-process production deployment.
- Mock mode uses sample values so the UI is demonstrable, and labels them to
  avoid confusing them with live research.

## What I would do differently with more time

- Add authentication, a shared job store, and background workers for
  production-scale research jobs.
- Add stronger source extraction and citations for each generated claim.
- Add end-to-end browser tests covering streaming, history, and failures.
