# Unfold — Developer Context

## What is this project?

Unfold is a "Talk-to-a-Folder" web app. Users authenticate with Google, paste any Google Drive link (folder or individual file), and chat with an AI agent that answers questions about the contents with inline citations.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 (no shadcn — raw Tailwind only) |
| Auth | `@react-oauth/google` implicit token flow |
| Backend | FastAPI + Python 3.11 |
| Drive API | `google-api-python-client` (Drive API v3) |
| LLM | Gemini 2.5 Flash via `google-genai` SDK v1.68+ |
| Embeddings | `gemini-embedding-001` via direct REST API (`requests`) |
| Vector Store | In-memory cosine similarity (NumPy) + disk cache |
| Rate Limiting | slowapi (10/min chat, 5/min ingest) |
| Retry | tenacity (exponential backoff, 5 attempts on Gemini ClientError) |
| PDF Parsing | PyPDF2 |
| Markdown | `react-markdown` + `remark-gfm` |
| Deploy | Render (backend + static frontend) |

## Architecture — Hybrid Context Strategy

The core architectural decision: Gemini 2.5 Flash has a 1M token context window.

- **Small content (< 200K tokens)**: ALL file contents sent directly in LLM context. No RAG. Perfect recall.
- **Large content (>= 200K tokens)**: Automatic fallback to RAG with HyDE — generates a hypothetical answer, embeds that instead of the raw query, retrieves top-20 chunks via cosine similarity across all loaded folder vector stores.
- The app auto-detects strategy after ingestion. A badge in the chat UI shows which mode is active.

## Project Structure

```
unfold/
├── backend/
│   ├── main.py                    # FastAPI app + CORS + slowapi setup
│   ├── models.py                  # Pydantic request/response models
│   ├── routers/
│   │   ├── drive.py               # GET /api/drive/list + POST /api/drive/ingest
│   │   └── chat.py                # POST /api/chat (streaming, async token validation)
│   └── services/
│       ├── google_drive.py        # Drive API: list, resolve, download; extract_drive_id()
│       ├── document_processor.py  # Text extraction + chunking (1500 char, 200 overlap)
│       ├── embeddings.py          # gemini-embedding-001 via REST API (batch + single)
│       ├── vector_store.py        # Thread-safe cosine similarity + disk cache in .cache/
│       ├── rag_engine.py          # HyDE + hybrid context + multi-folder merge + comparison mode
│       ├── prompts.py             # System prompt + full-context/RAG/comparison prompt builders
│       ├── token_estimator.py     # Gemini SDK token count; FULL_CONTEXT_THRESHOLD = 200K
│       └── limiter.py             # slowapi rate limiter config
└── frontend/
    └── src/
        ├── App.tsx                # Phase router: login → setup → chat; multi-folder state
        ├── api.ts                 # Typed API client (listFolder, ingestBatch, chatStream + HyDE extraction)
        ├── types.ts               # Shared TypeScript interfaces
        ├── index.css              # Tailwind + dark theme + animations
        └── components/
            ├── LoginScreen.tsx    # Full-screen auth with feature grid
            ├── SetupScreen.tsx    # URL input + ingestion progress
            ├── ChatScreen.tsx     # 2-panel chat + add-folder panel + export + truncation warning
            ├── FileTree.tsx       # Collapsible sidebar file tree
            └── MessageBubble.tsx  # Streaming message + HyDE card + citation cards
```

## Environment Variables

### Backend (`backend/.env`)
```
GOOGLE_GENERATIVE_AI_API_KEY=   # Google AI Studio API key
FRONTEND_URL=http://localhost:5173
```

### Frontend (`frontend/.env.local`)
```
VITE_GOOGLE_CLIENT_ID=          # Google Cloud Console OAuth 2.0 client ID
VITE_API_URL=http://localhost:8000
```

## Key Patterns

### Auth Flow
- `@react-oauth/google` implicit flow — user clicks Google button, gets `access_token` directly
- Token stored in React state + sessionStorage, passed as `Authorization: Bearer <token>` header
- Backend validates token via `validate_access_token()` → Google tokeninfo endpoint (runs in `run_in_executor` to avoid blocking async)
- No refresh tokens — session ends when tab closes or token expires (~1 hour)

### Drive URL Support
- `extract_drive_id(url)` in `google_drive.py` parses folder links, Doc/Sheet/Slide links, file links, and `?id=` shared links
- Returns `(id, type)` where type is `"folder"`, `"file"`, or `"unknown"`
- Unknown type resolved via Drive API `files().get(fields="mimeType")`
- Single files wrapped in a fake folder shape via `get_single_file_as_folder()`

### Ingestion Flow
1. Frontend calls `GET /api/drive/list?url=...` → gets file tree + flat file list
2. Frontend batches files (5 per batch) and calls `POST /api/drive/ingest` for each batch
3. Each batch response includes `truncatedFiles` list (files that hit the 100K char limit)
4. Last batch sets `isLastBatch: true` → backend finalises strategy + optionally builds vector store
5. Context stored in-memory AND serialised to `backend/.cache/{sanitised_key}.json`

### Disk Persistence
- `set_context(key, ctx)` and `set_store(key, store)` write JSON to `backend/.cache/`
- `get_context(key)` and `get_store(key)` check memory first, then fall back to disk
- Survives backend restarts; users don't need to re-ingest after a cold start
- Thread-safe: all reads/writes protected by `threading.Lock`

### HyDE (Hypothetical Document Embeddings)
- In RAG mode, `_generate_hypothetical_answer()` in `rag_engine.py` asks Gemini to write a short plausible answer to the query
- The hypothetical answer (not the raw query) is embedded via `embed_query()` for retrieval
- Rationale: answer-embeddings align much closer to document chunk embeddings than question-embeddings
- The hypothetical answer is streamed to the frontend via a special marker (`\x00HYDE\x00...\x00ENDH\x00`) before the actual response
- `api.ts` buffers the stream, extracts the HyDE marker, and fires an `onHyde` callback
- `MessageBubble.tsx` renders a collapsible amber `HydeCard` above the response showing what was used for retrieval

### Multi-Folder Support
- `App.tsx` manages arrays: `folderIds[]`, `folderNames[]`, `folderTrees[]`
- "Add folder" button in ChatScreen header opens an inline URL input panel
- Duplicate folder detection: `folderIds.includes(fid)` check before ingesting
- `rag_engine.py` accepts `context_keys: list[str]` and merges across all folders:
  - Full-context: if ALL folders use full-context AND combined tokens <= threshold
  - RAG: HyDE + deduplicated search across all vector stores (`seen_ids` set)
- Suggested questions regenerate across all folder IDs when a new folder is added

### Comparison Mode
- `rag_engine.py` detects comparison keywords ("compare", "difference", "contrast", "versus", " vs ")
- `build_comparison_prompt()` in `prompts.py` groups documents by physical folder with explicit folder name headers
- Prompt instructs LLM to compare folders BY NAME, not regroup thematically

### Citation System
- System prompt instructs LLM to place `[1]`, `[2]` inline markers in text
- After the answer, LLM appends `<!--CITATIONS_START-->[{...}]<!--CITATIONS_END-->`
- `parseCitations()` in `MessageBubble.tsx` splits text and citation JSON
- CitationCard renders expandable source cards with file name, path, excerpt, and Drive link

### Suggested Questions
- After ingestion completes, frontend calls `chatStream` with a special JSON-only prompt
- LLM returns a JSON array of 4 questions; parsed robustly with `slice(indexOf('['), lastIndexOf(']')+1)`
- Displayed as clickable chips in the empty chat state (eliminates blank-page problem)

### Streaming
- Chat endpoint uses FastAPI `StreamingResponse` with `text/plain`
- Frontend reads chunks via `ReadableStream` in `api.ts`, appends to message content
- In RAG mode, first chunk contains HyDE marker — `api.ts` buffers until marker is extracted, then streams normally
- Streaming cursor CSS on `.streaming-cursor p:last-child::after` blinks `▋` while loading
- Error detection: after stream completes, if content starts with `"Error:"`, message is marked as error and retry button shown

### Export Chat
- `handleExport()` in `ChatScreen.tsx` builds a Markdown document from conversation + citations
- Downloaded as `.md` file with folder name in filename
- Header includes date, strategy label, and token count

### Truncation Warning
- Backend tracks files exceeding 100K chars via `is_truncated` flag in `download_file_content()`
- `truncatedFiles` list returned in each ingest batch response
- Frontend accumulates across batches and passes to `ChatScreen`
- Dismissible amber banner at top of chat column listing affected files

## Coding Conventions

- TypeScript strict mode, no `any`
- No `@/` alias — use relative imports (`../types`, `./FileTree`)
- All components are client-side (Vite SPA, no SSR)
- Tailwind for all styling — no CSS modules, no styled-components
- Error handling: try/catch in API routes, return typed JSON; try/catch in frontend with `setError`
- API key never exposed in error messages (`_safe_raise` strips key from HTTP errors)
- No `console.log` in production code
