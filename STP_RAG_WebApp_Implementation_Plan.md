# STP-RAG Web Application — Implementation Plan

> A ChatGPT-style RAG interface with 3 switchable vector databases, transparent retrieval inspection, multi-format document ingestion, vault management, and a live comparison dashboard.

---

## 1. Architecture Overview

```mermaid
flowchart TD
    subgraph Frontend["Frontend — Next.js 14 + shadcn/ui"]
        Chat["Chat Interface"]
        Upload["Document Upload"]
        Vault["Vault Manager"]
        Retrieval["Retrieval Inspector"]
        Dashboard["Comparison Dashboard"]
    end

    subgraph Backend["Backend — FastAPI"]
        API["REST + WebSocket API"]
        Ingest["Ingestion Router"]
        Query["Query Router"]
        Metrics["Metrics Collector"]
    end

    subgraph Pipelines["3 Ingestion Pipelines"]
        P1["Pipeline 1: Fixed-Size Chunking"]
        P2["Pipeline 2: Semantic Similarity Chunking"]
        P3["Pipeline 3: STP-RAG Adaptive Chunking"]
    end

    subgraph VectorDBs["3 Qdrant Collections"]
        DB1["qdrant: vault_{id}_fixed_size"]
        DB2["qdrant: vault_{id}_semantic"]
        DB3["qdrant: vault_{id}_stp_rag"]
    end

    subgraph Infra["Infrastructure — Docker Compose"]
        Qdrant["Qdrant v1.12+"]
        Postgres["PostgreSQL 16"]
        Redis["Redis 7"]
        Ollama["Ollama / OpenAI"]
    end

    Chat --> API
    Upload --> API
    Vault --> API
    Dashboard --> API

    API --> Ingest
    API --> Query
    API --> Metrics

    Ingest --> P1 --> DB1
    Ingest --> P2 --> DB2
    Ingest --> P3 --> DB3

    Query --> DB1
    Query --> DB2
    Query --> DB3

    Metrics --> Dashboard
```

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) + TypeScript | SSR, streaming, great DX |
| **UI Components** | shadcn/ui + Tailwind CSS + Recharts | Polished ChatGPT-style UI + charting |
| **Backend API** | FastAPI (Python 3.11) | Async, WebSocket support, same language as `stp_rag/` |
| **Task Queue** | Celery + Redis | Background document ingestion |
| **Database (metadata)** | PostgreSQL 16 | Vaults, documents, conversations, messages |
| **Vector Store** | Qdrant (Docker, port 6333) | Already used in your `stp_rag/indexing/qdrant_store.py` |
| **Embedding Model** | `BAAI/bge-m3` via sentence-transformers | Already used in your `stp_rag/profile/embed.py` |
| **LLM Generation** | Ollama (phi3:mini default) + optional OpenAI | Already used in your `stp_rag/generation/answer.py` |
| **File Parsing** | `unstructured`, `python-pptx`, `python-docx`, `PyMuPDF` | Handles md, pdf, docx, pptx, xml, txt |
| **Containerization** | Docker Compose | Extends your existing `docker/docker-compose.yml` |

---

## 3. Project Directory Structure

```
capstone project/
├── stp_rag/                          # ← EXISTING library (untouched)
│   ├── chunking/
│   ├── context/
│   ├── eval/
│   ├── generation/
│   ├── indexing/
│   ├── ingestion/
│   ├── profile/
│   ├── retrieval/
│   └── tracking/
│
├── webapp/                           # ← NEW web application
│   ├── backend/
│   │   ├── app/
│   │   │   ├── main.py              # FastAPI app entry
│   │   │   ├── config.py            # Settings via pydantic-settings
│   │   │   ├── database.py          # SQLAlchemy async engine + session
│   │   │   ├── models/              # SQLAlchemy ORM models
│   │   │   │   ├── vault.py
│   │   │   │   ├── document.py
│   │   │   │   ├── conversation.py
│   │   │   │   └── message.py
│   │   │   ├── schemas/             # Pydantic request/response schemas
│   │   │   ├── routers/
│   │   │   │   ├── vaults.py        # CRUD vaults
│   │   │   │   ├── documents.py     # Upload + ingestion status
│   │   │   │   ├── chat.py          # Query + streaming generation
│   │   │   │   ├── retrieval.py     # Retrieval inspection endpoint
│   │   │   │   └── dashboard.py     # Comparison metrics endpoint
│   │   │   ├── services/
│   │   │   │   ├── ingestion_service.py    # Orchestrates 3 pipelines
│   │   │   │   ├── query_service.py        # Retrieves + generates
│   │   │   │   ├── parsing_service.py      # File → plain text
│   │   │   │   └── metrics_service.py      # Live comparison data
│   │   │   ├── workers/
│   │   │   │   └── celery_app.py           # Celery tasks
│   │   │   └── core/
│   │   │       └── pipeline_adapter.py     # Bridges stp_rag/ library
│   │   ├── alembic/                        # DB migrations
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx                # Chat page
│   │   │   │   ├── vaults/page.tsx         # Vault management
│   │   │   │   └── dashboard/page.tsx      # Comparison dashboard
│   │   │   ├── components/
│   │   │   │   ├── chat/
│   │   │   │   │   ├── ChatWindow.tsx
│   │   │   │   │   ├── MessageBubble.tsx
│   │   │   │   │   ├── PromptInput.tsx
│   │   │   │   │   └── PipelineSelector.tsx
│   │   │   │   ├── retrieval/
│   │   │   │   │   ├── RetrievalPanel.tsx
│   │   │   │   │   └── ChunkCard.tsx
│   │   │   │   ├── upload/
│   │   │   │   │   ├── UploadZone.tsx
│   │   │   │   │   └── IngestionProgress.tsx
│   │   │   │   ├── vault/
│   │   │   │   │   ├── VaultList.tsx
│   │   │   │   │   └── VaultCreateDialog.tsx
│   │   │   │   └── dashboard/
│   │   │   │       ├── ComparisonChart.tsx
│   │   │   │       ├── MetricsTable.tsx
│   │   │   │       └── ChunkDistribution.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useChat.ts
│   │   │   │   └── useWebSocket.ts
│   │   │   └── lib/
│   │   │       └── api.ts                  # Typed API client
│   │   ├── package.json
│   │   ├── tailwind.config.ts
│   │   └── Dockerfile
│   │
│   └── docker-compose.yml                  # Full-stack orchestration
│
├── configs/                                # ← EXISTING
├── docker/                                 # ← EXISTING (Qdrant + MLflow)
└── pyproject.toml                          # ← EXISTING
```

---

## 4. Database Schema (PostgreSQL)

```mermaid
erDiagram
    VAULT ||--o{ DOCUMENT : contains
    VAULT ||--o{ CONVERSATION : has
    CONVERSATION ||--o{ MESSAGE : contains
    DOCUMENT ||--o{ INGESTION_JOB : triggers

    VAULT {
        uuid id PK
        string name
        string description
        timestamp created_at
        timestamp updated_at
    }

    DOCUMENT {
        uuid id PK
        uuid vault_id FK
        string filename
        string file_type
        int file_size_bytes
        string storage_path
        string raw_text
        string status "pending | processing | ready | error"
        timestamp created_at
    }

    INGESTION_JOB {
        uuid id PK
        uuid document_id FK
        string pipeline "fixed_size | semantic | stp_rag"
        string status "queued | running | done | error"
        int chunk_count
        float build_time_sec
        json metadata
        timestamp started_at
        timestamp completed_at
    }

    CONVERSATION {
        uuid id PK
        uuid vault_id FK
        string title
        string active_pipeline "fixed_size | semantic | stp_rag"
        timestamp created_at
    }

    MESSAGE {
        uuid id PK
        uuid conversation_id FK
        string role "user | assistant"
        text content
        string pipeline_used
        json retrieved_chunks
        json retrieval_metrics
        float latency_ms
        timestamp created_at
    }
```

---

## 5. The 3 Ingestion Pipelines (Detailed)

Each pipeline reuses your existing `stp_rag/` library modules. When a user uploads a document to a vault, all 3 pipelines run in parallel via Celery, populating 3 separate Qdrant collections.

### Pipeline 1 — Fixed-Size Chunking

| Step | Module / Function | What It Does |
|---|---|---|
| 1. Parse file → plain text | `parsing_service.py` | Converts pdf/docx/pptx/xml/md → text |
| 2. Extract structure units | `stp_rag.ingestion.structure_units.extract_structure_aware_units()` | Sentence-level units with structural flags |
| 3. Compute embeddings | `stp_rag.profile.embed.EmbeddingModelWrapper.embed_texts()` | BGE-M3 embeddings with SQLite cache |
| 4. Compute STP (dummy) | `stp_rag.profile.stp.compute_stp()` | Required by variant API (signals zeroed out) |
| 5. Build chunks | `stp_rag.chunking.variants.build_chunks_for_variant("fixed_size", ...)` | Fixed `L_max` token windows, no semantic signals |
| 6. Index to Qdrant | `stp_rag.indexing.qdrant_store.STPVectorStore.index_chunks()` | Collection: `vault_{vault_id}_fixed_size` |

### Pipeline 2 — Semantic Similarity Chunking

| Step | Module / Function | What It Does |
|---|---|---|
| 1–4 | Same as Pipeline 1 | Parse → units → embed → STP |
| 5. Build chunks | `build_chunks_for_variant("similarity_threshold", ...)` | Splits when cosine displacement $d_i > \tau_{\text{sim}}$ |
| 6. Index to Qdrant | `STPVectorStore.index_chunks()` | Collection: `vault_{vault_id}_semantic` |

### Pipeline 3 — STP-RAG Adaptive Chunking

| Step | Module / Function | What It Does |
|---|---|---|
| 1–4 | Same as Pipeline 1 | Parse → units → embed → STP (all signals active) |
| 5. Build chunks | `build_chunks_for_variant("full_stp_context", ...)` | Full kinematic boundary + adaptive budget |
| 6. Context propagation | `stp_rag.context.selective_propagation.select_and_propagate_context()` | Selective predecessor context augmentation |
| 7. Index to Qdrant | `STPVectorStore.index_chunks()` | Collection: `vault_{vault_id}_stp_rag` |

> [!IMPORTANT]
> All 3 pipelines share the same parsed text and unit embeddings (computed once, reused). Only the chunking strategy and collection differ.

---

## 6. API Endpoints

### 6.1 Vault Management

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/vaults` | Create a new vault |
| `GET` | `/api/vaults` | List all vaults |
| `GET` | `/api/vaults/{id}` | Get vault details + document count |
| `DELETE` | `/api/vaults/{id}` | Delete vault + all associated Qdrant collections |

### 6.2 Document Upload & Ingestion

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/vaults/{id}/documents` | Upload file (multipart), triggers 3 parallel ingestion jobs |
| `GET` | `/api/vaults/{id}/documents` | List documents in vault with ingestion status |
| `GET` | `/api/documents/{id}/status` | Per-document ingestion progress across all 3 pipelines |
| `DELETE` | `/api/documents/{id}` | Remove document + its chunks from all 3 collections |

### 6.3 Chat & Query

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Send query → retrieve → generate (returns full response) |
| `WS` | `/ws/chat/{conversation_id}` | WebSocket for streaming token-by-token generation |
| `POST` | `/api/chat/compare` | Send query to all 3 pipelines simultaneously, returns side-by-side |

**Request body for `/api/chat`:**
```json
{
  "vault_id": "uuid",
  "conversation_id": "uuid | null",
  "query": "What is semantic velocity?",
  "pipeline": "stp_rag",
  "top_k": 5,
  "show_retrievals": true
}
```

**Response body:**
```json
{
  "message_id": "uuid",
  "answer": "Semantic velocity v_i measures...",
  "pipeline_used": "stp_rag",
  "retrieved_chunks": [
    {
      "chunk_id": 42,
      "text": "The semantic velocity v_i = d_i / (Δp_i + ε)...",
      "score": 0.847,
      "token_count": 187,
      "metadata": {
        "doc_id": "uuid",
        "filename": "stp_paper.pdf",
        "context_horizon": 3,
        "selected_predecessor_ids": [39, 41]
      }
    }
  ],
  "retrieval_metrics": {
    "latency_ms": 12.4,
    "chunks_searched": 1547
  }
}
```

### 6.4 Retrieval Inspection

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/retrieval/inspect` | Retrieve chunks from a specific pipeline without generation |
| `POST` | `/api/retrieval/compare` | Retrieve from all 3 pipelines, return side-by-side chunks |

### 6.5 Dashboard & Comparison Metrics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/vault/{id}/stats` | Aggregated stats per pipeline for a vault |
| `GET` | `/api/dashboard/vault/{id}/chunk-distribution` | Chunk size distribution per pipeline |
| `GET` | `/api/dashboard/vault/{id}/latency-history` | Query latency time series |
| `GET` | `/api/dashboard/vault/{id}/retrieval-quality` | Average retrieval scores per pipeline |

**Dashboard stats response:**
```json
{
  "vault_id": "uuid",
  "pipelines": {
    "fixed_size": {
      "total_chunks": 1200,
      "avg_tokens_per_chunk": 500,
      "std_tokens_per_chunk": 0,
      "avg_build_time_sec": 2.3,
      "avg_retrieval_latency_ms": 8.1,
      "total_documents": 15
    },
    "semantic": {
      "total_chunks": 980,
      "avg_tokens_per_chunk": 312,
      "std_tokens_per_chunk": 145,
      "avg_build_time_sec": 2.8,
      "avg_retrieval_latency_ms": 7.6,
      "total_documents": 15
    },
    "stp_rag": {
      "total_chunks": 850,
      "avg_tokens_per_chunk": 287,
      "std_tokens_per_chunk": 168,
      "avg_build_time_sec": 4.1,
      "avg_retrieval_latency_ms": 9.2,
      "total_documents": 15
    }
  }
}
```

---

## 7. Frontend Pages & Components

### 7.1 Chat Page (Main View)

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Vault: Research Papers ▼]   [Pipeline: STP-RAG ▼]   [⚙ Settings] │
├────────────────────────────────┬─────────────────────────────────────┤
│                                │                                     │
│   Conversation History         │   Retrieved Chunks Panel            │
│                                │                                     │
│   ┌─────────────────────┐      │   Chunk 1 (score: 0.847)           │
│   │ User: What is       │      │   ┌───────────────────────────┐    │
│   │ semantic velocity?  │      │   │ "The semantic velocity     │    │
│   └─────────────────────┘      │   │  v_i = d_i / (Δp_i + ε)" │    │
│                                │   │  📄 stp_paper.pdf         │    │
│   ┌─────────────────────┐      │   │  tokens: 187 | ctx: 3    │    │
│   │ Assistant: Semantic  │      │   └───────────────────────────┘    │
│   │ velocity measures    │      │                                     │
│   │ the rate of topic    │      │   Chunk 2 (score: 0.791)           │
│   │ change...            │      │   ┌───────────────────────────┐    │
│   └─────────────────────┘      │   │ ...                       │    │
│                                │   └───────────────────────────┘    │
│                                │                                     │
├────────────────────────────────┴─────────────────────────────────────┤
│  [📎 Upload]  Type your question here...               [Send ▶]     │
└──────────────────────────────────────────────────────────────────────┘
```

**Key features:**
- **Pipeline Selector** — dropdown to switch between Fixed-Size, Semantic, and STP-RAG at any point mid-conversation
- **Retrieval Panel** — collapsible right sidebar showing the exact chunks retrieved, their scores, source document, token count, and (for STP-RAG) context horizon + propagated predecessor IDs
- **Streaming output** — tokens stream in real-time via WebSocket
- **Inline upload** — drag-and-drop or click to upload documents to the active vault

### 7.2 Vault Manager Page

- Create / rename / delete vaults
- View all documents per vault with file type icons
- Per-document ingestion status badges (3 pipeline progress bars)
- Bulk upload with drag-and-drop zone
- Supported formats shown: `.md`, `.pdf`, `.docx`, `.pptx`, `.xml`, `.txt`, `.csv`, `.html`

### 7.3 Comparison Dashboard Page

```
┌──────────────────────────────────────────────────────────────────────┐
│  Dashboard — Vault: Research Papers                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─── Chunk Size Distribution ───┐  ┌─── Retrieval Latency ────┐   │
│  │  [Histogram / Violin Plot]    │  │  [Line chart over time]  │   │
│  │  Fixed ■  Semantic ■  STP ■   │  │  Fixed ── Sem ── STP ──  │   │
│  └───────────────────────────────┘  └──────────────────────────┘   │
│                                                                      │
│  ┌─── Metrics Comparison Table ──────────────────────────────────┐  │
│  │ Metric           │ Fixed-Size │ Semantic │ STP-RAG            │  │
│  │ Total Chunks     │ 1,200      │ 980      │ 850                │  │
│  │ Avg Tokens/Chunk │ 500        │ 312      │ 287                │  │
│  │ Std Tokens/Chunk │ 0          │ 145      │ 168                │  │
│  │ Build Time (s)   │ 2.3        │ 2.8      │ 4.1                │  │
│  │ Avg Latency (ms) │ 8.1        │ 7.6      │ 9.2                │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─── Side-by-Side Retrieval Test ───────────────────────────────┐  │
│  │ Query: [________________________________] [Compare ▶]         │  │
│  │                                                                │  │
│  │ Fixed-Size         │ Semantic           │ STP-RAG             │  │
│  │ Chunk 1: ...       │ Chunk 1: ...       │ Chunk 1: ...        │  │
│  │ Chunk 2: ...       │ Chunk 2: ...       │ Chunk 2: ...        │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

**Dashboard charts (Recharts):**
1. **Chunk Size Distribution** — overlaid histograms for all 3 pipelines
2. **Retrieval Latency Over Time** — line chart tracking per-query latency
3. **Metrics Comparison Table** — live stats from Qdrant collection metadata
4. **Side-by-Side Retrieval Tester** — type a query, see all 3 pipelines' retrieved chunks and scores simultaneously

---

## 8. Implementation Phases

### Phase 1: Backend Foundation (Days 1–3)

| Task | File(s) | Details |
|---|---|---|
| 1.1 | `webapp/backend/app/main.py`, `config.py` | FastAPI app scaffold, CORS, lifespan, settings |
| 1.2 | `webapp/backend/app/database.py` | SQLAlchemy async engine + `AsyncSession` with PostgreSQL |
| 1.3 | `webapp/backend/app/models/` | ORM models: Vault, Document, IngestionJob, Conversation, Message |
| 1.4 | `webapp/backend/alembic/` | Alembic migrations setup, initial `CREATE TABLE` migration |
| 1.5 | `webapp/backend/app/schemas/` | Pydantic v2 schemas for all request/response bodies |
| 1.6 | `webapp/backend/app/routers/vaults.py` | CRUD endpoints for vault management |
| 1.7 | `webapp/docker-compose.yml` | Add PostgreSQL + Redis containers alongside existing Qdrant |

**Validation:** `POST /api/vaults` creates a vault, `GET /api/vaults` returns it. DB migrations apply cleanly.

### Phase 2: Document Parsing & Ingestion (Days 4–6)

| Task | File(s) | Details |
|---|---|---|
| 2.1 | `webapp/backend/app/services/parsing_service.py` | File type detection + parsing: `PyMuPDF` (pdf), `python-docx` (docx), `python-pptx` (pptx), `xml.etree` (xml), raw read (md/txt/csv/html) |
| 2.2 | `webapp/backend/app/core/pipeline_adapter.py` | Adapter wrapping `stp_rag/` library functions for web use — shared embedding computation, per-variant chunking, Qdrant indexing with persistent (non-in-memory) collections |
| 2.3 | `webapp/backend/app/services/ingestion_service.py` | Orchestrator: parse file → compute shared units + embeddings → fan out to 3 pipeline variants → index each to its Qdrant collection |
| 2.4 | `webapp/backend/app/workers/celery_app.py` | Celery task `ingest_document` — runs ingestion_service in background worker |
| 2.5 | `webapp/backend/app/routers/documents.py` | Upload endpoint (multipart), triggers Celery task, returns job IDs. Status polling endpoint |

**Key adapter code** — the bridge between your library and the web app:

```python
# webapp/backend/app/core/pipeline_adapter.py

from stp_rag.ingestion.structure_units import extract_structure_aware_units
from stp_rag.profile.embed import EmbeddingModelWrapper
from stp_rag.profile.stp import compute_stp
from stp_rag.profile.structural_features import compute_structural_score
from stp_rag.chunking.variants import build_chunks_for_variant
from stp_rag.context.selective_propagation import select_and_propagate_context
from stp_rag.indexing.qdrant_store import STPVectorStore

PIPELINE_VARIANTS = {
    "fixed_size": "fixed_size",
    "semantic": "similarity_threshold",
    "stp_rag": "full_stp_context",
}

class PipelineAdapter:
    def __init__(self, config_path="configs/stp_params.yaml"):
        self.embedder = EmbeddingModelWrapper(model_name="BAAI/bge-m3")
        self.config = load_yaml_config(config_path)

    def ingest_document(self, vault_id: str, doc_text: str, doc_id: str):
        """Runs all 3 pipelines on the same document text."""
        # Shared computation (done once)
        units = extract_structure_aware_units(doc_text)
        embeddings = self.embedder.embed_texts([u.text for u in units])
        cum_tokens = np.array([u.cumulative_tokens for u in units])
        s_score, _, _ = compute_structural_score(units)
        stp = compute_stp(embeddings, cum_tokens, s_score,
                          norm_stats=self.config.get("normalization"))

        results = {}
        for pipeline_name, variant in PIPELINE_VARIANTS.items():
            chunks = build_chunks_for_variant(variant, units, stp,
                                               embeddings, self.config.get("weights", {}))
            if variant == "full_stp_context":
                chunks = select_and_propagate_context(chunks, stp)

            collection = f"vault_{vault_id}_{pipeline_name}"
            store = STPVectorStore(collection_name=collection,
                                   embedding_dim=embeddings.shape[1],
                                   use_memory=False)
            build_time = store.index_chunks(chunks)
            results[pipeline_name] = {
                "chunk_count": len(chunks),
                "build_time_sec": build_time
            }

        return results
```

**Validation:** Upload a PDF → all 3 Qdrant collections populated. Ingestion status shows "done" for all 3 pipelines.

### Phase 3: Query, Retrieval & Generation (Days 7–9)

| Task | File(s) | Details |
|---|---|---|
| 3.1 | `webapp/backend/app/services/query_service.py` | Takes user query + selected pipeline → embed query → search correct Qdrant collection → assemble context → call LLM → return answer + retrieved chunks |
| 3.2 | `webapp/backend/app/routers/chat.py` | REST `POST /api/chat` + WebSocket `/ws/chat/{id}` for streaming |
| 3.3 | `webapp/backend/app/routers/retrieval.py` | `/api/retrieval/inspect` (single pipeline) + `/api/retrieval/compare` (all 3) |
| 3.4 | Modify `stp_rag/indexing/qdrant_store.py` | Add `search_with_scores()` method returning chunk text + similarity score (not just IDs) |
| 3.5 | Modify `stp_rag/generation/answer.py` | Add `generate_stream()` method yielding tokens for WebSocket |

**Validation:** Send a query → get generated answer + retrieved chunks with scores for the selected pipeline. WebSocket streams tokens.

### Phase 4: Frontend Chat Interface (Days 10–14)

| Task | File(s) | Details |
|---|---|---|
| 4.1 | Frontend scaffold | `npx create-next-app@latest frontend --typescript --tailwind --app` + `npx shadcn@latest init` |
| 4.2 | `ChatWindow.tsx`, `MessageBubble.tsx` | Scrollable message list with user/assistant bubbles, markdown rendering |
| 4.3 | `PromptInput.tsx` | Text input with send button, file attach button, keyboard shortcuts |
| 4.4 | `PipelineSelector.tsx` | Dropdown: "Fixed-Size", "Semantic Similarity", "STP-RAG (Ours)" |
| 4.5 | `RetrievalPanel.tsx`, `ChunkCard.tsx` | Collapsible right sidebar showing retrieved chunks, scores, source file, token count, STP metadata |
| 4.6 | `useChat.ts`, `useWebSocket.ts` | Hooks for managing conversation state + WebSocket streaming |
| 4.7 | `UploadZone.tsx`, `IngestionProgress.tsx` | Drag-and-drop upload with progress bars for 3 pipelines |

**Validation:** Full chat loop works — type query → see streaming answer + retrieved chunks in sidebar → switch pipeline → re-query → see different results.

### Phase 5: Vault Management UI (Days 15–16)

| Task | File(s) | Details |
|---|---|---|
| 5.1 | `VaultList.tsx`, `VaultCreateDialog.tsx` | List vaults with doc counts, create/delete dialogs |
| 5.2 | `vaults/page.tsx` | Full vault management page with document table, upload zone, ingestion status badges |
| 5.3 | API integration | Connect vault CRUD + document upload to backend endpoints |

**Validation:** Create vault → upload 3 documents of different formats → see all 3 pipeline statuses reach "done" → switch to chat and query the vault.

### Phase 6: Comparison Dashboard (Days 17–20)

| Task | File(s) | Details |
|---|---|---|
| 6.1 | `webapp/backend/app/services/metrics_service.py` | Aggregates chunk stats from Qdrant, query latency from message history, computes distributions |
| 6.2 | `webapp/backend/app/routers/dashboard.py` | Dashboard API endpoints |
| 6.3 | `ComparisonChart.tsx` | Recharts histograms for chunk size distribution across 3 pipelines |
| 6.4 | `MetricsTable.tsx` | Side-by-side metrics table (chunks, tokens, latency, build time) |
| 6.5 | `ChunkDistribution.tsx` | Violin/box plot of token counts per pipeline |
| 6.6 | Side-by-side retrieval tester | Input query → see 3 columns of retrieved chunks simultaneously |
| 6.7 | `dashboard/page.tsx` | Assemble all dashboard components into cohesive page |

**Validation:** Dashboard shows real data for an ingested vault. Histograms render correctly. Side-by-side retrieval shows visibly different chunking results.

### Phase 7: Polish, Testing & Deployment (Days 21–24)

| Task | Details |
|---|---|
| 7.1 | Error handling — toast notifications, retry logic, loading skeletons |
| 7.2 | Responsive design — mobile-friendly chat, collapsible sidebar |
| 7.3 | Dark mode toggle (shadcn/ui theme) |
| 7.4 | Backend unit tests (pytest) for pipeline adapter, query service |
| 7.5 | Frontend component tests (Vitest + React Testing Library) |
| 7.6 | E2E smoke test — upload doc → query → verify answer in all 3 pipelines |
| 7.7 | Production Docker Compose with Nginx reverse proxy |
| 7.8 | README.md with setup instructions |

---

## 9. Docker Compose (Full Stack)

```yaml
# webapp/docker-compose.yml
version: '3.8'

services:
  # --- Infrastructure ---
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: stp_rag_web
      POSTGRES_USER: stp_user
      POSTGRES_PASSWORD: stp_pass
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  qdrant:
    image: qdrant/qdrant:latest
    ports: ["6333:6333", "6334:6334"]
    volumes: [qdrant_data:/qdrant/storage]

  # --- Backend ---
  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql+asyncpg://stp_user:stp_pass@postgres:5432/stp_rag_web
      REDIS_URL: redis://redis:6379/0
      QDRANT_URL: http://qdrant:6333
      OLLAMA_URL: http://host.docker.internal:11434/api/generate
    depends_on: [postgres, redis, qdrant]
    volumes:
      - ../stp_rag:/app/stp_rag        # Mount existing library
      - ../configs:/app/configs          # Mount existing configs
      - uploads:/app/uploads

  celery-worker:
    build: ./backend
    command: celery -A app.workers.celery_app worker --loglevel=info --concurrency=2
    environment:
      DATABASE_URL: postgresql+asyncpg://stp_user:stp_pass@postgres:5432/stp_rag_web
      REDIS_URL: redis://redis:6379/0
      QDRANT_URL: http://qdrant:6333
    depends_on: [postgres, redis, qdrant]
    volumes:
      - ../stp_rag:/app/stp_rag
      - ../configs:/app/configs
      - uploads:/app/uploads

  # --- Frontend ---
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
      NEXT_PUBLIC_WS_URL: ws://localhost:8000
    depends_on: [backend]

volumes:
  postgres_data:
  qdrant_data:
  uploads:
```

---

## 10. Key Modifications to Existing `stp_rag/` Library

> [!NOTE]
> The existing library is designed for batch experiment pipelines. These minimal additions make it web-ready without breaking the research codebase.

| File | Change | Purpose |
|---|---|---|
| `indexing/qdrant_store.py` | Add `search_with_payloads(query_vec, top_k)` → returns chunk text + score + metadata | Dashboard and retrieval panel need full chunk data, not just IDs |
| `indexing/qdrant_store.py` | Make `__init__` accept `recreate=False` flag (default keeps existing collection) | Web collections are persistent, not recreated on every query |
| `generation/answer.py` | Add `generate_stream(question, contexts)` → yields token strings | WebSocket streaming in chat |
| `generation/answer.py` | Add OpenAI-compatible provider option alongside Ollama | Users may want to use OpenAI/Groq API keys |
| `profile/embed.py` | No changes needed | SQLite cache already handles persistence correctly |

---

## 11. Supported File Formats — Parsing Strategy

| Format | Library | Extraction Logic |
|---|---|---|
| `.md` | Built-in `open()` | Read as-is (markdown) |
| `.txt` | Built-in `open()` | Read as-is (plain text) |
| `.pdf` | `PyMuPDF` (fitz) | Extract text page by page, preserve paragraph breaks |
| `.docx` | `python-docx` | Extract paragraphs, preserve heading hierarchy |
| `.pptx` | `python-pptx` | Extract text from each slide's shapes, add `## Slide N` headers |
| `.xml` | `xml.etree.ElementTree` | Strip tags, extract `text_content()` |
| `.csv` | Built-in `csv` | Convert rows to structured text paragraphs |
| `.html` | `BeautifulSoup` | Strip tags, extract body text with structure |

---

## 12. Environment Variables

```env
# Backend
DATABASE_URL=postgresql+asyncpg://stp_user:stp_pass@localhost:5432/stp_rag_web
REDIS_URL=redis://localhost:6379/0
QDRANT_URL=http://localhost:6333
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_MODEL=phi3:mini
EMBEDDING_MODEL=BAAI/bge-m3
STP_CONFIG_PATH=configs/stp_params.yaml
MAX_UPLOAD_SIZE_MB=50
CELERY_BROKER_URL=redis://localhost:6379/0

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## 13. Timeline Summary

```mermaid
flowchart LR
    P1["Phase 1\nBackend Foundation\nDays 1-3"] --> P2["Phase 2\nIngestion Pipelines\nDays 4-6"]
    P2 --> P3["Phase 3\nQuery + Generation\nDays 7-9"]
    P3 --> P4["Phase 4\nChat Frontend\nDays 10-14"]
    P4 --> P5["Phase 5\nVault UI\nDays 15-16"]
    P5 --> P6["Phase 6\nDashboard\nDays 17-20"]
    P6 --> P7["Phase 7\nPolish + Deploy\nDays 21-24"]
```

| Phase | Days | Deliverable |
|---|---|---|
| 1. Backend Foundation | 1–3 | FastAPI + PostgreSQL + ORM + Vault CRUD |
| 2. Ingestion Pipelines | 4–6 | 3 parallel pipelines + file parsing + Celery |
| 3. Query & Generation | 7–9 | Retrieval + LLM generation + WebSocket streaming |
| 4. Chat Frontend | 10–14 | Full ChatGPT-style interface with pipeline switching |
| 5. Vault Management UI | 15–16 | Upload, status tracking, vault CRUD |
| 6. Comparison Dashboard | 17–20 | Charts, metrics table, side-by-side retrieval tester |
| 7. Polish & Deploy | 21–24 | Error handling, tests, Docker production build |

> [!TIP]
> **Parallel track:** Frontend scaffold (Phase 4.1) can start on Day 7 alongside Phase 3, since the API contract is defined by Phase 2.

---

## 14. Risk Mitigation

| Risk | Mitigation |
|---|---|
| Embedding model (BGE-M3) slow on CPU | Pre-compute embeddings once, cache in SQLite (already implemented in `embed.py`). Optionally run on GPU worker. |
| Qdrant collection proliferation | Naming convention `vault_{id}_{pipeline}` + cleanup on vault deletion |
| Large file uploads blocking API | Celery background workers handle all ingestion asynchronously |
| Ollama offline / slow | Graceful fallback message (already in `answer.py`). Add optional OpenAI provider. |
| STP config drift | SHA-256 checksum validation on `stp_params.yaml` (already implemented in `pipeline.py`) |
