# Unfold

**Talk to any Google Drive folder.** Authenticate with Google, paste a Drive link, and chat with an AI that answers questions about your files — with inline citations, streaming responses, and automatic retrieval strategy selection.

## Key Features

- **Hybrid Context Strategy** — small folders (< 200K tokens) use full-context for perfect recall; large folders automatically switch to RAG with vector search
- **HyDE (Hypothetical Document Embeddings)** — in RAG mode, generates a hypothetical answer before embedding to improve retrieval precision. The intermediate step is surfaced in the UI for transparency
- **Multi-Folder Chat** — load multiple Drive folders into a single conversation with cross-folder retrieval and deduplication
- **Inline Citations** — every response includes numbered source markers with expandable cards showing file name, excerpt, and a link back to Drive
- **Suggested Questions** — after ingestion, the LLM generates 4 context-aware questions as clickable chips
- **Folder Comparison** — detects comparison queries and structures the prompt by folder for accurate side-by-side analysis
- **Export Chat** — download the full conversation as a Markdown file with citations preserved
- **Streaming End-to-End** — FastAPI `StreamingResponse` to browser `ReadableStream` for real-time token output
- **Truncation Warnings** — files exceeding 100K chars are flagged in the UI so users know answers may be incomplete
- **Production Hardening** — rate limiting (slowapi), thread-safe vector store, async-safe token validation, tenacity retry with exponential backoff on Gemini API calls

## Architecture

```
Frontend (React 19 + Vite)              Backend (FastAPI + Python 3.11)
┌──────────────────────────┐            ┌──────────────────────────────┐
│  LoginScreen             │            │  POST /api/drive/list        │
│  SetupScreen  ──────────────────────▶ │    folder URL → file tree    │
│  ChatScreen              │            │                              │
│    FileTree              │            │  POST /api/drive/ingest      │
│    MessageBubble         │            │    download → chunk → embed  │
│    HydeCard              │            │                              │
│    CitationCard          │            │  POST /api/chat (streaming)  │
└──────────────────────────┘            │    full-context OR HyDE+RAG  │
                                        └──────────┬───────────────────┘
                                                   │
                         ┌─────────────────────────┼──────────────────┐
                         ▼                         ▼                  ▼
                   Google OAuth            Google Drive API     Gemini 2.5 Flash
                   (drive.readonly)        v3                  + gemini-embedding-001
```

### Hybrid Context Strategy

Gemini 2.5 Flash has a **1M token context window** — this shapes the core architecture:

| Content Size | Strategy | How It Works |
|---|---|---|
| < 200K tokens | **Full Context** | All file content sent directly in the LLM prompt. Perfect recall, no retrieval errors. |
| >= 200K tokens | **RAG + HyDE** | Generates a hypothetical answer, embeds it (not the raw query), and retrieves top-20 chunks via cosine similarity. |

The strategy is auto-selected after ingestion. A badge in the UI shows which mode is active.

### Why HyDE?

Questions and document chunks occupy different regions of embedding space. The query *"What does Darwin say about natural selection?"* is semantically far from the actual text *"Darwin argues that natural selection favors organisms best adapted..."*. HyDE bridges this gap by generating a plausible short answer first and embedding **that** — answer-embeddings align much closer to real document chunks than question-embeddings do.

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Auth | `@react-oauth/google` (implicit flow) |
| Backend | FastAPI + Python 3.11 |
| Drive API | `google-api-python-client` (v3) |
| LLM | Gemini 2.5 Flash via `google-genai` SDK |
| Embeddings | `gemini-embedding-001` via REST API |
| Vector Store | In-memory cosine similarity (NumPy) + disk cache |
| Rate Limiting | slowapi |
| Retry | tenacity (exponential backoff) |
| PDF Parsing | PyPDF2 |
| Deploy | Render (backend + static frontend) |

## Supported Inputs

Any Google Drive link works — folders, Docs, Sheets, Slides, PDFs, plain text, code files, and shared links. Images and video are skipped.

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- Google Cloud Console project with **Google Drive API** enabled
- Google AI Studio API key

### 1. Clone

```bash
git clone https://github.com/MiKueen/unfold.git
cd unfold
```

### 2. Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Google Drive API**
3. Configure **OAuth Consent Screen** → add scope `drive.readonly`
4. Create **OAuth 2.0 Client ID** (Web application)
   - Authorised JavaScript origins: `http://localhost:5173`
   - No redirect URIs needed (implicit token flow)

### 3. Backend

```bash
cd backend
conda create -n unfold python=3.11 -y
conda activate unfold
pip install -r requirements.txt
cp .env.example .env   # then fill in your API key
uvicorn main:app --reload
```

### 4. Frontend

```bash
cd frontend
cp .env.example .env.local   # then fill in your OAuth client ID
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Project Structure

```
unfold/
├── backend/
│   ├── main.py                    # FastAPI app, CORS, rate limiter setup
│   ├── models.py                  # Pydantic request/response models
│   ├── routers/
│   │   ├── drive.py               # /api/drive/list + /api/drive/ingest
│   │   └── chat.py                # /api/chat (streaming, async token validation)
│   └── services/
│       ├── google_drive.py        # Drive API: list, resolve, download, truncation
│       ├── document_processor.py  # Text extraction + chunking (1500 char, 200 overlap)
│       ├── embeddings.py          # gemini-embedding-001 via REST API (batch support)
│       ├── vector_store.py        # Thread-safe cosine similarity + disk cache
│       ├── rag_engine.py          # HyDE + hybrid context orchestrator + multi-folder merge
│       ├── prompts.py             # System prompt, full-context/RAG/comparison builders
│       ├── token_estimator.py     # Gemini SDK token count with heuristic fallback
│       └── limiter.py             # slowapi rate limiter config
├── frontend/
│   └── src/
│       ├── App.tsx                # State management, multi-folder orchestration
│       ├── api.ts                 # Typed API client with HyDE stream extraction
│       ├── types.ts               # Shared TypeScript interfaces
│       └── components/
│           ├── LoginScreen.tsx    # Google OAuth with feature grid
│           ├── SetupScreen.tsx    # URL input + ingestion progress
│           ├── ChatScreen.tsx     # Chat UI, add-folder panel, export, truncation warning
│           ├── FileTree.tsx       # Collapsible sidebar file tree
│           └── MessageBubble.tsx  # Streaming messages, HyDE card, citation cards
└── render.yaml                    # Render deployment blueprint
```

## How It Works

1. **Sign in** with Google — grants read-only Drive access via OAuth implicit flow
2. **Paste** any Google Drive folder or file link
3. **Ingest** — files are downloaded, parsed, chunked, and optionally embedded; results cached to disk
4. **Strategy selection** — if total tokens < 200K, use full context; otherwise build vector store for RAG
5. **Suggested questions** — LLM analyses the content and surfaces 4 relevant starting questions
6. **Chat** — ask anything; responses stream in real-time with inline citations
7. **Add more folders** — load additional Drive folders into the same conversation for cross-folder Q&A
8. **Export** — download the conversation as Markdown with citations preserved

