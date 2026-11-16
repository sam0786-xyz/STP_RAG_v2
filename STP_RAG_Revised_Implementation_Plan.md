# STP-RAG Research & Evaluation Platform

## Revised Final-Year Project Implementation Plan

**Project type:** Research-oriented RAG system and experimental web
platform\
**Core contribution:** STP-RAG adaptive chunking and selective context
propagation\
**Baseline methods:** Fixed-size chunking and semantic-similarity
chunking\
**Proposed schedule:** Six weeks, assuming the existing research library
is substantially functional.

------------------------------------------------------------------------

## 1. Executive Summary

This project will develop an interactive research and evaluation
platform for comparing three Retrieval-Augmented Generation (RAG)
chunking strategies under controlled experimental conditions:

1.  **Fixed-size chunking:** A conventional token-window baseline.
2.  **Semantic-similarity chunking:** A baseline that detects boundaries
    using semantic displacement or similarity thresholds.
3.  **STP-RAG:** The proposed adaptive chunking and selective
    context-propagation approach.

The platform will provide document ingestion, isolated document vaults,
conversational RAG, retrieval inspection, chunk-boundary visualization,
benchmark evaluation, experiment tracking, and comparative analytics.

The web application is an instrument for demonstrating and investigating
the research contribution. It must not replace the research contribution
itself. The primary evidence will come from reproducible experiments
measuring retrieval quality, answer quality, faithfulness, latency,
indexing cost, and resource overhead.

### Objectives

-   Integrate the existing `stp_rag/` research library into a
    maintainable application.
-   Implement three comparable ingestion and retrieval pipelines.
-   Keep documents, chunks, configurations, and experiment results
    traceable.
-   Build a benchmark dataset with questions, reference answers, and
    evidence passages.
-   Evaluate retrieval and generation quality using identical test
    conditions.
-   Make chunking decisions and retrieval behavior inspectable.
-   Provide reproducible experiment records and exportable results.
-   Deploy the complete system using Docker Compose.

### Initial scope exclusions

The first release will not attempt enterprise multi-tenancy, distributed
multi-node Qdrant, complex organization-level permissions, collaborative
editing, foundation-model fine-tuning, or every possible document and
multimodal format. These can be future extensions.

------------------------------------------------------------------------

## 2. System Architecture

The application is divided into three major subsystems.

### 2.1 RAG application subsystem

Responsibilities:

-   Vault and document management.
-   Document parsing and ingestion.
-   Three chunking pipelines.
-   Vector indexing and retrieval.
-   Context construction and answer generation.
-   Conversation history and streaming responses.

### 2.2 Research and evaluation subsystem

Responsibilities:

-   Benchmark dataset management.
-   Controlled execution across all three pipelines.
-   Retrieval and generation evaluation.
-   Hallucination-related assessment.
-   Latency and resource measurement.
-   Experiment configuration and result history.
-   Export of reproducible results.

### 2.3 Visualization and analytics subsystem

Responsibilities:

-   Chunk-boundary and chunk-size visualization.
-   Retrieval result inspection.
-   Context propagation inspection.
-   Side-by-side pipeline comparison.
-   Evaluation dashboards.
-   Historical experiment comparisons.

### 2.4 High-level architecture

``` mermaid
flowchart TB
    UI["Next.js Research Workbench"]
    API["FastAPI Application API"]

    subgraph APP["RAG Application"]
        VAULT["Vault and Document Management"]
        INGEST["Ingestion Orchestrator"]
        QUERY["Query and Generation Service"]
        CHAT["Conversation Service"]
    end

    subgraph PIPELINES["Comparable Chunking Pipelines"]
        FIXED["Fixed-Size Baseline"]
        SEM["Semantic-Similarity Baseline"]
        STP["STP-RAG Proposed Method"]
    end

    subgraph STORAGE["Persistence"]
        PG["PostgreSQL: Metadata and Experiments"]
        QD["Qdrant: Vector Collections"]
        FILES["Document File Storage"]
        REDIS["Redis: Task Broker and Cache"]
    end

    subgraph EVAL["Research and Evaluation"]
        DATASET["Benchmark Dataset"]
        RUNNER["Evaluation Runner"]
        METRICS["Retrieval, Answer, Faithfulness and Cost Metrics"]
        TRACK["Experiment Tracking"]
    end

    subgraph MODELS["Model Services"]
        EMBED["BGE-M3 Embeddings"]
        LLM["Ollama / Optional API Provider"]
    end

    UI --> API
    API --> VAULT
    API --> INGEST
    API --> QUERY
    API --> CHAT
    INGEST --> FIXED
    INGEST --> SEM
    INGEST --> STP
    FIXED --> QD
    SEM --> QD
    STP --> QD
    INGEST --> EMBED
    QUERY --> EMBED
    QUERY --> QD
    QUERY --> LLM
    VAULT --> PG
    INGEST --> PG
    CHAT --> PG
    VAULT --> FILES
    INGEST --> REDIS
    REDIS --> INGEST
    DATASET --> RUNNER
    RUNNER --> FIXED
    RUNNER --> SEM
    RUNNER --> STP
    RUNNER --> METRICS
    METRICS --> TRACK
    TRACK --> PG
    API --> EVAL
    EVAL --> UI
```

### 2.5 Architectural principles

1.  Keep the research library independent from the web application.
2.  Put web-specific integration in adapters and services, not inside
    research algorithms.
3.  Use the same source documents and benchmark questions for all
    methods.
4.  Record model versions, pipeline parameters, and dataset versions for
    every experiment.
5.  Keep retrieval results and generated answers traceable to their
    source chunks.
6.  Treat uploaded documents as untrusted input.
7.  Make background jobs retryable and idempotent.
8.  Prefer measured evidence over hardcoded or illustrative dashboard
    values.

------------------------------------------------------------------------

## 3. Technology Stack

  -----------------------------------------------------------------------
  Layer                   Technology              Responsibility
  ----------------------- ----------------------- -----------------------
  Frontend                Next.js, TypeScript     Research workbench UI

  UI components           shadcn/ui, Tailwind CSS Interface components
                                                  and styling

  Charts                  Recharts                Evaluation and
                                                  performance
                                                  visualizations

  Backend                 FastAPI, Python 3.11+   REST API and streaming

  ORM                     SQLAlchemy 2.x async    PostgreSQL access

  Migrations              Alembic                 Database schema
                                                  evolution

  Validation              Pydantic v2             Request and response
                                                  schemas

  Background jobs         Celery                  Document ingestion and
                                                  evaluation tasks

  Broker                  Redis                   Celery broker and
                                                  optional cache

  Metadata database       PostgreSQL              Vaults, documents,
                                                  jobs, conversations,
                                                  experiments

  Vector store            Qdrant                  Embedding and chunk
                                                  retrieval

  Embeddings              BAAI/bge-m3             Document and query
                                                  embeddings

  LLM                     Ollama, optional hosted Answer generation
                          provider                

  Parsing                 PyMuPDF, python-docx,   File extraction
                          python-pptx,            
                          BeautifulSoup, standard 
                          libraries               

  Evaluation              Ragas where suitable,   RAG evaluation
                          plus custom metrics     

  Experiment tracking     PostgreSQL-backed       Reproducibility and
                          experiment records;     experiment history
                          optional MLflow         

  Testing                 pytest, Vitest, React   Automated tests
                          Testing Library         

  Deployment              Docker Compose          Local and demonstration
                                                  deployment
  -----------------------------------------------------------------------

### Stack decisions

-   Keep FastAPI, PostgreSQL, Qdrant, Redis, and the existing STP-RAG
    library.
-   Use a currently supported Next.js release rather than treating
    Next.js 14 as a fixed requirement.
-   Pin tested Docker image versions. Avoid `latest` for reproducible
    deployment.
-   Keep evaluation independent of the chat UI.
-   Do not introduce additional infrastructure unless a demonstrated
    requirement justifies it.

------------------------------------------------------------------------

## 4. Repository Structure

``` text
project-root/
├── stp_rag/                         # Existing research library
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
├── webapp/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   ├── dependencies.py
│   │   │   ├── models/
│   │   │   │   ├── user.py
│   │   │   │   ├── vault.py
│   │   │   │   ├── document.py
│   │   │   │   ├── ingestion_job.py
│   │   │   │   ├── conversation.py
│   │   │   │   ├── message.py
│   │   │   │   ├── benchmark_dataset.py
│   │   │   │   ├── evaluation_run.py
│   │   │   │   └── experiment.py
│   │   │   ├── schemas/
│   │   │   ├── routers/
│   │   │   │   ├── auth.py
│   │   │   │   ├── vaults.py
│   │   │   │   ├── documents.py
│   │   │   │   ├── chat.py
│   │   │   │   ├── retrieval.py
│   │   │   │   ├── evaluations.py
│   │   │   │   ├── benchmarks.py
│   │   │   │   ├── experiments.py
│   │   │   │   └── dashboard.py
│   │   │   ├── services/
│   │   │   │   ├── vault_service.py
│   │   │   │   ├── parsing_service.py
│   │   │   │   ├── ingestion_service.py
│   │   │   │   ├── query_service.py
│   │   │   │   ├── retrieval_service.py
│   │   │   │   ├── evaluation_service.py
│   │   │   │   ├── metrics_service.py
│   │   │   │   └── experiment_service.py
│   │   │   ├── core/
│   │   │   │   ├── pipeline_adapter.py
│   │   │   │   ├── model_provider.py
│   │   │   │   ├── storage.py
│   │   │   │   └── security.py
│   │   │   ├── workers/
│   │   │   │   ├── celery_app.py
│   │   │   │   ├── ingestion_tasks.py
│   │   │   │   └── evaluation_tasks.py
│   │   │   └── utils/
│   │   ├── alembic/
│   │   ├── tests/
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── chat/
│   │   │   │   ├── vaults/
│   │   │   │   ├── evaluations/
│   │   │   │   ├── experiments/
│   │   │   │   └── dashboard/
│   │   │   ├── components/
│   │   │   │   ├── chat/
│   │   │   │   ├── vault/
│   │   │   │   ├── upload/
│   │   │   │   ├── retrieval/
│   │   │   │   ├── chunk-visualizer/
│   │   │   │   ├── evaluation/
│   │   │   │   └── dashboard/
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   └── docker-compose.yml
│
├── configs/
├── datasets/
│   ├── source_documents/
│   ├── benchmark/
│   └── README.md
├── experiments/
│   ├── configs/
│   └── results/
├── docs/
│   ├── architecture.md
│   ├── evaluation_methodology.md
│   └── api_contracts.md
├── docker/
└── pyproject.toml
```

Adapt exact modules to the existing repository after an audit. Do not
create duplicate abstractions if the research library already provides
equivalent functionality.

------------------------------------------------------------------------

## 5. Research Methodology and Experimental Design

This is a first-class project component, not a final dashboard feature.

### 5.1 Research comparison

  -----------------------------------------------------------------------------
  Dimension         Fixed-size           Semantic similarity  STP-RAG
  ----------------- -------------------- -------------------- -----------------
  Chunking policy   Fixed token windows  Similarity-driven    Proposed adaptive
                                         boundaries           method

  Semantic signal   Not used for         Used                 As defined by
                    boundaries                                STP-RAG

  Structural signal Baseline-dependent   Baseline-dependent   As defined by the
                                                              method

  Adaptive budget   No                   Only if implemented  As defined by the
                                         in baseline          method

  Context           No                   No                   Selective
  propagation                                                 propagation

  Purpose           Conventional         Semantic baseline    Proposed method
                    baseline                                  
  -----------------------------------------------------------------------------

This is a target comparison contract. Final entries must match the
actual implementations. Do not claim that a baseline excludes a signal
unless its code demonstrably excludes it.

### 5.2 Fair comparison controls

Keep the following constant across all three pipelines wherever
applicable:

-   Source documents and document versions.
-   Text extraction output.
-   Embedding model and embedding configuration.
-   Query set and reference answers.
-   Retrieval `top_k`.
-   Similarity metric and filtering rules.
-   Generation model and model parameters.
-   Prompt template and context token budget.
-   Hardware and execution environment.
-   Evaluation procedure and scoring rules.

Record unavoidable differences, such as context propagation overhead,
rather than hiding them.

### 5.3 Benchmark dataset

Create a versioned benchmark containing:

  -----------------------------------------------------------------------
  Field                               Description
  ----------------------------------- -----------------------------------
  `question_id`                       Stable question identifier

  `document_id`                       Source document identifier

  `question`                          Evaluation question

  `reference_answer`                  Human-validated expected answer

  `evidence_passages`                 Ground-truth evidence passage IDs
                                      or text spans

  `question_type`                     Factual, conceptual, multi-hop,
                                      unanswerable, etc.

  `difficulty`                        Optional difficulty label

  `dataset_version`                   Benchmark version
  -----------------------------------------------------------------------

Start with approximately 100--200 carefully validated questions if time
permits. A smaller, high-quality benchmark is preferable to a larger
dataset with unreliable labels.

Include:

-   Factual questions.
-   Conceptual questions.
-   Multi-hop questions.
-   Questions requiring information from different document sections.
-   Questions with insufficient evidence or no answer in the corpus.

Human-review reference answers and evidence passages. Keep a held-out
subset if the method or parameters are being tuned against the
benchmark.

### 5.4 Evaluation metrics

#### A. Retrieval quality

  Metric        Purpose
  ------------- ---------------------------------------------------
  Recall@K      Whether relevant evidence is retrieved
  Precision@K   Proportion of retrieved results judged relevant
  MRR           Rewards a relevant result appearing near the top
  nDCG@K        Ranking quality with graded relevance
  Hit Rate@K    Whether at least one relevant result is retrieved

Define relevance at a consistent level. If evaluation is based on source
passages, map retrieved chunks back to source spans or document
evidence. Do not rely on unstable chunk IDs across different chunking
strategies.

#### B. Generation quality

  -----------------------------------------------------------------------
  Metric                              Purpose
  ----------------------------------- -----------------------------------
  Answer correctness                  Agreement with reference answer

  Answer relevancy                    Whether the response answers the
                                      question

  Faithfulness                        Whether answer claims are supported
                                      by retrieved context

  Context precision                   Relevance of retrieved context

  Context recall                      Coverage of reference evidence by
                                      retrieved context
  -----------------------------------------------------------------------

Use Ragas for suitable metrics where its inputs and assumptions fit the
dataset. Add custom evaluators where required. Record evaluator model
and version.

#### C. Hallucination-related evaluation

Do not label a faithfulness score as a directly measured hallucination
rate without a defined protocol.

Recommended procedure:

1.  Split generated answers into factual claims.
2.  Identify whether each claim is supported, contradicted, or not
    supported by retrieved evidence.
3.  Compute the proportion of unsupported claims under the documented
    definition.
4.  Human-review a representative sample of claims.
5.  Report evaluator agreement and limitations.

For unanswerable questions, assess whether the system abstains
appropriately rather than inventing an answer.

#### D. Performance and cost

-   Embedding time.
-   Indexing/build time.
-   Retrieval latency.
-   Time to first token.
-   Generation latency.
-   End-to-end latency.
-   P50 and P95 latency.
-   Input and output token counts where available.
-   Peak memory usage where measurable.
-   Vector storage size.
-   Number of chunks and vectors.

Report hardware, model versions, warm-up procedure, concurrency, and
number of repetitions. Use repeated runs and report mean and
variability, not a single timing sample.

#### E. Chunking characteristics

-   Chunk count.
-   Mean, median, and standard deviation of chunk token count.
-   Minimum and maximum chunk size.
-   Chunk size distribution.
-   Boundary distribution.
-   Context propagation count and token overhead.
-   Index size.

These are descriptive measures, not proof of retrieval superiority.

### 5.5 Experiment record

Every evaluation run must save:

-   Dataset ID and version.
-   Source document versions or checksums.
-   Pipeline name and configuration.
-   Chunking parameters.
-   Embedding model and version.
-   Generation model and version.
-   Retrieval parameters.
-   Prompt version.
-   Evaluation metric versions.
-   Hardware and software environment.
-   Start/end timestamps.
-   Raw per-question outputs and scores.
-   Aggregated metrics.
-   Error and incomplete-run information.

This is required to reproduce comparisons later.

------------------------------------------------------------------------

## 6. Data Model

Use PostgreSQL for application metadata and experiment records. Store
document binaries in a managed local volume for the initial deployment,
with a storage abstraction so object storage can be added later.

### 6.1 Core entities

``` mermaid
erDiagram
    USER ||--o{ VAULT : owns
    VAULT ||--o{ DOCUMENT : contains
    DOCUMENT ||--o{ INGESTION_JOB : has
    VAULT ||--o{ CONVERSATION : has
    CONVERSATION ||--o{ MESSAGE : contains
    BENCHMARK_DATASET ||--o{ EVALUATION_RUN : evaluated_in
    EVALUATION_RUN ||--o{ EVALUATION_RESULT : contains
    EXPERIMENT ||--o{ EVALUATION_RUN : groups

    USER {
        uuid id PK
        string email
        string password_hash
        timestamp created_at
    }

    VAULT {
        uuid id PK
        uuid owner_id FK
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
        bigint file_size_bytes
        string checksum
        string storage_path
        string status
        timestamp created_at
    }

    INGESTION_JOB {
        uuid id PK
        uuid document_id FK
        string pipeline
        string status
        int chunk_count
        float build_time_sec
        string config_version
        text error_message
        timestamp started_at
        timestamp completed_at
    }

    CONVERSATION {
        uuid id PK
        uuid vault_id FK
        string title
        string active_pipeline
        timestamp created_at
    }

    MESSAGE {
        uuid id PK
        uuid conversation_id FK
        string role
        text content
        string pipeline_used
        json retrieved_chunks
        json retrieval_metrics
        float latency_ms
        timestamp created_at
    }

    BENCHMARK_DATASET {
        uuid id PK
        string name
        string version
        string storage_path
        timestamp created_at
    }

    EXPERIMENT {
        uuid id PK
        string name
        json configuration
        timestamp created_at
    }

    EVALUATION_RUN {
        uuid id PK
        uuid dataset_id FK
        uuid experiment_id FK
        string status
        json environment
        timestamp started_at
        timestamp completed_at
    }

    EVALUATION_RESULT {
        uuid id PK
        uuid evaluation_run_id FK
        string pipeline
        json aggregate_metrics
        json result_artifact
    }
```

### 6.2 Document and ingestion lifecycle

A document has an overall state and three independently tracked pipeline
jobs.

Document states:

-   `uploaded`
-   `processing`
-   `partially_ready`
-   `ready`
-   `failed`
-   `deleting`

Ingestion job states:

-   `queued`
-   `running`
-   `succeeded`
-   `failed`
-   `cancelled`

The document is `ready` only when all required pipeline jobs have
succeeded. If some pipelines succeed and others fail, report
`partially_ready` and expose each job's status.

### 6.3 Idempotency and versioning

-   Calculate a checksum for every uploaded file.
-   Prevent accidental duplicate ingestion within the same vault.
-   Give every ingestion request a stable job ID.
-   Make retries safe.
-   Store pipeline configuration versions and checksums.
-   Store source document versions.
-   Support explicit re-indexing when parsing, embedding, or chunking
    configuration changes.

### 6.4 Qdrant payload

Every vector point should include enough metadata for filtering,
inspection, and deletion.

``` json
{
  "vault_id": "vault-uuid",
  "document_id": "document-uuid",
  "pipeline": "stp_rag",
  "chunk_id": "stable-chunk-id",
  "source_page": 4,
  "token_count": 187,
  "content": "Chunk text...",
  "config_version": "stp-config-v1"
}
```

Use a stable point identifier or deterministic point ID derived from
document version, pipeline, and chunk identity. Preserve source offsets
or passage references where the parser can provide them.

------------------------------------------------------------------------

## 7. Vector Database Strategy

### 7.1 Initial strategy: three collections per vault

``` text
Qdrant
├── vault_<id>_fixed_size
├── vault_<id>_semantic
└── vault_<id>_stp_rag
```

Advantages:

-   Clear separation of pipeline results.
-   Simple pipeline selection.
-   Straightforward side-by-side retrieval.
-   Easier cleanup and debugging.

Disadvantages:

-   Collection count grows with vault count.
-   Collection lifecycle needs automation.
-   More operational metadata to manage.

This is recommended for the initial academic implementation because it
prioritizes clarity over large-scale collection efficiency.

### 7.2 Collection lifecycle

-   Create collections lazily or during vault initialization.
-   Verify vector dimension and distance metric before indexing.
-   Do not recreate an existing collection on every query or retry.
-   Use deterministic IDs and upsert semantics where appropriate.
-   Delete document points using `vault_id` and `document_id` filters.
-   Delete all three collections when a vault is permanently deleted.
-   Handle partial deletion failures and provide a retryable cleanup
    job.

### 7.3 Future alternative

If collection proliferation becomes a real operational problem, evaluate
three global collections with strict `vault_id` and `document_id`
payload filtering. Do not implement both strategies initially.

------------------------------------------------------------------------

## 8. Ingestion Pipelines

### 8.1 Shared ingestion flow

``` mermaid
flowchart TD
    A["Upload document"] --> B["Validate file and calculate checksum"]
    B --> C["Store original file"]
    C --> D["Extract text and structural metadata"]
    D --> E["Normalize and create source units"]
    E --> F["Compute shared embeddings"]
    F --> G["Run three pipeline variants in parallel"]
    G --> H1["Fixed-size chunking"]
    G --> H2["Semantic-similarity chunking"]
    G --> H3["STP-RAG chunking"]
    H1 --> I1["Index fixed-size collection"]
    H2 --> I2["Index semantic collection"]
    H3 --> I3["Index STP-RAG collection"]
    I1 --> J["Persist job metrics and status"]
    I2 --> J
    I3 --> J
```

### 8.2 Pipeline 1: Fixed-size chunking

1.  Parse the source document.
2.  Extract normalized source units.
3.  Compute or reuse shared embeddings if required by the library.
4.  Build fixed token-window chunks using a documented window size and
    overlap policy.
5.  Preserve source document and passage metadata.
6.  Index into the fixed-size collection.
7.  Record chunk count, token distribution, build time, and
    configuration.

The baseline must not accidentally use STP boundary signals or context
propagation unless the baseline definition explicitly requires them.

### 8.3 Pipeline 2: Semantic-similarity chunking

1.  Reuse the same parsed source units.
2.  Reuse the same embedding model and embeddings.
3.  Calculate semantic displacement or similarity according to the
    implemented baseline.
4.  Split at the configured threshold.
5.  Apply documented minimum and maximum chunk constraints if part of
    the baseline.
6.  Index into the semantic collection.
7.  Record threshold, chunk statistics, and build time.

Document the exact threshold definition and whether the split condition
is `>` or another comparison.

### 8.4 Pipeline 3: STP-RAG

1.  Reuse the same parsed source units and embeddings.
2.  Compute the STP signals defined by the research method.
3.  Apply the proposed kinematic boundary and adaptive-budget logic.
4.  Generate adaptive chunks.
5.  Apply selective predecessor context propagation.
6.  Preserve original chunk identity and propagated-context provenance.
7.  Index into the STP-RAG collection.
8.  Record signal configuration, context horizon, propagation decisions,
    token overhead, and build time.

### 8.5 Shared computation and isolation

The plan proposes sharing parsed text and embeddings across pipelines.
This is efficient, but shared artifacts must be immutable and versioned.

Each variant must receive only the inputs required by its defined
method. Verify that baseline implementations do not consume STP-specific
signals accidentally.

Before writing the web adapter, inspect the real function signatures and
return types in the existing library. The adapter code must be written
against the actual implementation, not assumed APIs.

### 8.6 Adapter contract

Create a small, explicit adapter interface:

``` python
class ChunkingPipelineAdapter:
    def ingest(
        self,
        document_id: str,
        vault_id: str,
        parsed_document,
        shared_artifacts,
        pipeline_config,
    ):
        """
        Return:
          - chunks
          - chunk metadata
          - build metrics
          - configuration fingerprint
        """
        raise NotImplementedError
```

Implement or wrap one adapter per variant if that makes the contracts
clearer. Keep Qdrant persistence outside the core chunking algorithm
where possible.

### 8.7 Ingestion failure handling

-   Persist job state before work begins.
-   Retry transient infrastructure failures with bounded retries.
-   Do not retry invalid files indefinitely.
-   Capture a concise error code and diagnostic message.
-   Avoid duplicate points on retry.
-   Permit one pipeline to fail without erasing successful pipeline
    results.
-   Provide a re-index operation after a parser or configuration change.

------------------------------------------------------------------------

## 9. Document Parsing

Initial supported formats:

  -------------------------------------------------------------------------
  Format                  Library                   Extraction strategy
  ----------------------- ------------------------- -----------------------
  `.md`                   Built-in file handling    Preserve Markdown
                                                    headings and text

  `.txt`                  Built-in file handling    Plain text

  `.pdf`                  PyMuPDF                   Page-wise text
                                                    extraction and page
                                                    metadata

  `.docx`                 python-docx               Paragraphs, headings,
                                                    tables where supported

  `.pptx`                 python-pptx               Slide text with slide
                                                    identifiers

  `.xml`                  `xml.etree.ElementTree`   Safe XML parsing and
                                                    text extraction

  `.csv`                  Python `csv`              Structured row or table
                                                    representation

  `.html`                 BeautifulSoup             Extract readable body
                                                    text and headings
  -------------------------------------------------------------------------

### Parsing requirements

-   Validate file extension, MIME type, and file signature where
    practical.
-   Enforce upload size and processing time limits.
-   Preserve page, slide, heading, and source offset metadata where
    possible.
-   Detect empty or image-only PDFs and report unsupported extraction
    clearly.
-   Do not execute macros, scripts, or embedded content.
-   Treat extracted document text as untrusted content.
-   Record parser version and extraction warnings.
-   Make OCR a future extension unless it is a necessary project
    requirement.

------------------------------------------------------------------------

## 10. Retrieval and Generation

### 10.1 Query flow

``` mermaid
sequenceDiagram
    participant U as User
    participant API as FastAPI
    participant Q as Query Service
    participant E as Embedding Model
    participant V as Qdrant
    participant L as LLM
    participant DB as PostgreSQL

    U->>API: Submit question and pipeline
    API->>Q: Validate vault and pipeline
    Q->>E: Embed query
    E-->>Q: Query vector
    Q->>V: Search selected collection
    V-->>Q: Chunks, scores, payloads
    Q->>Q: Build bounded context
    Q->>L: Generate answer using context
    L-->>Q: Answer or token stream
    Q->>DB: Save message and retrieval metadata
    Q-->>API: Answer, sources, metrics
    API-->>U: Response or stream
```

### 10.2 Query controls

A query request should support:

-   `vault_id`
-   `conversation_id`
-   `query`
-   `pipeline`
-   `top_k`
-   `show_retrievals`
-   Optional documented filters

The response should contain:

-   Answer.
-   Pipeline used.
-   Retrieved chunks and scores.
-   Source document references.
-   Retrieval latency.
-   Generation latency.
-   End-to-end latency.
-   Model identifiers.
-   Context token count where available.

### 10.3 Retrieval correctness

-   Apply vault and document filters consistently.
-   Validate the selected collection and embedding dimension.
-   Record the distance metric and score interpretation.
-   Do not present raw similarity scores as calibrated probabilities.
-   Preserve original and propagated context separately.
-   Enforce a context token budget.
-   Avoid duplicate evidence in assembled context.
-   Track the provenance of every context segment.

### 10.4 Generation and streaming

-   Support a non-streaming REST query endpoint.
-   Support streaming using WebSocket or Server-Sent Events. Choose one
    for the initial implementation unless both are genuinely needed.
-   Persist the completed assistant response and relevant metadata.
-   Handle client disconnects and model-provider errors.
-   Keep provider-specific code behind a model-provider interface.
-   Do not expose API keys to the frontend.

### 10.5 Conversation pipeline switching

Allow users to switch pipelines between queries. Each message must
retain the pipeline that actually generated it. Do not silently
reinterpret historical messages when the active pipeline changes.

------------------------------------------------------------------------

## 11. API Design

Prefix application endpoints with `/api/v1`.

### 11.1 Authentication and vault management

  -----------------------------------------------------------------------------
  Method                  Endpoint                      Purpose
  ----------------------- ----------------------------- -----------------------
  POST                    `/api/v1/auth/register`       Register user, if
                                                        authentication is
                                                        enabled

  POST                    `/api/v1/auth/login`          Login

  GET                     `/api/v1/vaults`              List accessible vaults

  POST                    `/api/v1/vaults`              Create vault

  GET                     `/api/v1/vaults/{vault_id}`   Get vault details

  PATCH                   `/api/v1/vaults/{vault_id}`   Rename or update vault

  DELETE                  `/api/v1/vaults/{vault_id}`   Delete vault and
                                                        associated resources
  -----------------------------------------------------------------------------

For a single-user demonstration, authentication can be simplified, but
authorization boundaries should still be explicit in the service design.

### 11.2 Documents and ingestion

  -------------------------------------------------------------------------------------------
  Method                  Endpoint                                    Purpose
  ----------------------- ------------------------------------------- -----------------------
  POST                    `/api/v1/vaults/{vault_id}/documents`       Upload and enqueue
                                                                      ingestion

  GET                     `/api/v1/vaults/{vault_id}/documents`       List documents

  GET                     `/api/v1/documents/{document_id}`           Document details

  GET                     `/api/v1/documents/{document_id}/status`    Overall and
                                                                      per-pipeline status

  GET                     `/api/v1/documents/{document_id}/chunks`    Inspect indexed chunks

  POST                    `/api/v1/documents/{document_id}/reindex`   Re-index document

  DELETE                  `/api/v1/documents/{document_id}`           Delete file, jobs, and
                                                                      vector points
  -------------------------------------------------------------------------------------------

### 11.3 Chat and retrieval

  -----------------------------------------------------------------------------
  Method                  Endpoint                      Purpose
  ----------------------- ----------------------------- -----------------------
  POST                    `/api/v1/chat`                Non-streaming RAG query

  WS or SSE               `/api/v1/chat/stream`         Streaming RAG response

  POST                    `/api/v1/chat/compare`        Compare generated
                                                        answers across three
                                                        pipelines

  POST                    `/api/v1/retrieval/inspect`   Inspect one pipeline's
                                                        retrieval

  POST                    `/api/v1/retrieval/compare`   Compare retrieved
                                                        chunks across pipelines
  -----------------------------------------------------------------------------

### 11.4 Evaluation and experiments

  Method   Endpoint                             Purpose
  -------- ------------------------------------ -----------------------------------
  POST     `/api/v1/benchmarks`                 Create or upload benchmark
  GET      `/api/v1/benchmarks`                 List benchmarks
  GET      `/api/v1/benchmarks/{id}`            Get benchmark metadata
  POST     `/api/v1/evaluations/run`            Start an evaluation job
  GET      `/api/v1/evaluations/{id}`           Get evaluation status and summary
  GET      `/api/v1/evaluations/{id}/results`   Get per-question results
  GET      `/api/v1/evaluations/{id}/compare`   Compare pipeline results
  GET      `/api/v1/experiments`                List experiments
  POST     `/api/v1/experiments`                Save experiment configuration
  GET      `/api/v1/experiments/{id}`           Inspect experiment

### 11.5 Dashboard

  ----------------------------------------------------------------------------------------------------
  Method                  Endpoint                                             Purpose
  ----------------------- ---------------------------------------------------- -----------------------
  GET                     `/api/v1/dashboard/vaults/{id}/stats`                Vault and pipeline
                                                                               statistics

  GET                     `/api/v1/dashboard/vaults/{id}/chunk-distribution`   Chunk size
                                                                               distributions

  GET                     `/api/v1/dashboard/evaluations/{id}`                 Evaluation metrics

  GET                     `/api/v1/dashboard/latency`                          Latency summaries

  GET                     `/api/v1/dashboard/experiments/compare`              Historical experiment
                                                                               comparison
  ----------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 12. Frontend Modules

### 12.1 Research workbench

Main navigation:

-   Chat
-   Vaults
-   Chunk Visualizer
-   Evaluation Studio
-   Experiments
-   Analytics

### 12.2 Chat interface

-   Conversation list.
-   Vault selector.
-   Pipeline selector.
-   Streaming answer.
-   Source citations.
-   Retrieved chunk sidebar.
-   Upload shortcut.
-   Per-message latency and model metadata.

### 12.3 Vault manager

-   Create, rename, and delete vaults.
-   Document list and file metadata.
-   Upload and bulk upload.
-   Per-pipeline ingestion progress.
-   Failed-job diagnostics and retry.
-   Document re-indexing and deletion.

### 12.4 Chunk visualizer

This is a core research demonstration feature.

-   Display extracted document structure.
-   Display chunk boundaries for each pipeline.
-   Highlight each chunk within its source document where offsets are
    available.
-   Display token counts and boundary metadata.
-   Show adaptive budget or boundary signals where available.
-   Display propagated predecessor context separately from the original
    chunk.
-   Compare the three variants on the same source document.

### 12.5 Retrieval inspector

-   Retrieved chunk text.
-   Rank and raw retrieval score.
-   Source document and page/slide.
-   Token count.
-   Context inclusion status.
-   Original versus propagated content.
-   Predecessor IDs and propagation metadata.
-   Filters for document and pipeline.

### 12.6 Evaluation Studio

-   Select benchmark dataset and version.
-   Select one or all pipelines.
-   Configure retrieval and generation parameters.
-   Start background evaluation.
-   Display progress and failures.
-   Show aggregate and per-question metrics.
-   Inspect generated answers against references and evidence.
-   Export results.

### 12.7 Experiment dashboard

Recommended charts:

1.  Recall@K and Precision@K comparison.
2.  MRR and nDCG comparison.
3.  Faithfulness and answer correctness comparison.
4.  Unsupported-claim rate under the documented protocol.
5.  Chunk token-count distributions.
6.  Indexing time and storage comparison.
7.  P50/P95 retrieval and end-to-end latency.
8.  Context token overhead.
9.  Per-question performance breakdown.

Always show dataset, configuration, and model identifiers alongside
results. Do not display illustrative sample values as live measurements.

------------------------------------------------------------------------

## 13. Security, Reliability, and Operations

### 13.1 Security

-   Validate file size, MIME type, extension, and content.
-   Generate server-side filenames; do not trust uploaded paths.
-   Store uploads outside publicly served frontend directories.
-   Restrict parser resource consumption.
-   Protect API keys and database credentials with environment secrets.
-   Use authentication and enforce vault ownership where applicable.
-   Validate all vault and document IDs against the current user.
-   Rate-limit expensive query and evaluation endpoints.
-   Treat retrieved document text as untrusted input.
-   Defend against prompt injection by separating system instructions
    from retrieved content and instructing the model not to follow
    document-embedded commands.
-   Avoid returning secrets or internal filesystem paths in errors.

### 13.2 Reliability

-   Use database transactions for metadata changes.
-   Use retryable, idempotent background jobs.
-   Add health checks for PostgreSQL, Redis, Qdrant, backend, and
    worker.
-   Add bounded retries for provider failures.
-   Track partial ingestion and deletion failures.
-   Persist job status and diagnostics.
-   Use structured logs with request, document, and job identifiers.
-   Add database and document-volume backup instructions.

### 13.3 Resource management

BGE-M3 and local LLM inference may be resource-intensive. Begin with
small test documents and a small number of concurrent jobs. Measure
actual RAM, VRAM, CPU, and latency before increasing concurrency.

Use one shared embedding service or controlled worker process where
practical to avoid loading duplicate model instances in every Celery
process.

------------------------------------------------------------------------

## 14. Docker Compose and Deployment

### 14.1 Services

-   `frontend`
-   `backend`
-   `celery-worker`
-   `postgres`
-   `redis`
-   `qdrant`
-   `ollama` if local model hosting is part of the deployment

### 14.2 Operational requirements

-   Pin image versions.
-   Add health checks and service readiness handling.
-   Use persistent volumes for PostgreSQL, Qdrant, uploads, and model
    data as appropriate.
-   Use `.env` for local configuration and secrets management for
    deployed environments.
-   Do not commit real credentials.
-   Configure Linux host access to Ollama explicitly if Ollama runs
    outside Docker.
-   Keep internal service URLs separate from browser-facing API URLs.
-   Use a reverse proxy and HTTPS if exposed beyond a trusted local
    network.
-   Provide startup, migration, backup, and restore instructions.

### 14.3 Example environment variables

``` env
APP_ENV=development
SECRET_KEY=replace_with_secure_secret

DATABASE_URL=postgresql+asyncpg://user:password@postgres:5432/stp_rag
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0

QDRANT_URL=http://qdrant:6333

OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=phi3:mini

EMBEDDING_MODEL=BAAI/bge-m3
STP_CONFIG_PATH=/app/configs/stp_params.yaml

MAX_UPLOAD_SIZE_MB=50
UPLOAD_DIR=/app/uploads
```

The actual model, embedding, and concurrency settings must be selected
after testing on the target machine. Keep provider API keys out of
frontend environment variables.

------------------------------------------------------------------------

## 15. Testing and Validation Strategy

### 15.1 Research library tests

-   Unit tests for each chunking variant.
-   Boundary-condition tests.
-   Token-budget tests.
-   Context propagation tests.
-   Deterministic behavior tests where expected.
-   Tests proving baseline variants do not accidentally consume
    proposed-method signals.
-   Configuration validation tests.

### 15.2 Backend tests

-   Vault CRUD and authorization.
-   File validation and parsing.
-   Duplicate upload handling.
-   Ingestion success, failure, retry, and idempotency.
-   Qdrant indexing and deletion.
-   Retrieval filtering.
-   Context assembly.
-   Provider errors and streaming disconnects.
-   Evaluation job lifecycle.

### 15.3 Frontend tests

-   Chat submission and streaming state.
-   Pipeline switching.
-   Vault selection.
-   Upload validation and progress.
-   Retrieval inspector rendering.
-   Evaluation configuration and result views.
-   Error and empty states.

### 15.4 End-to-end tests

1.  Create a vault.
2.  Upload a supported document.
3.  Verify all three ingestion jobs.
4.  Inspect chunks from all three pipelines.
5.  Submit the same question to each pipeline.
6.  Verify retrieved chunks and source metadata.
7.  Run a small benchmark.
8.  Inspect evaluation metrics.
9.  Delete the document.
10. Verify associated vector points and files are removed.

### 15.5 Research acceptance tests

Before presenting comparative results, verify:

-   All methods use the same source corpus.
-   The same benchmark questions are used.
-   Evaluation settings are documented.
-   The generation model and prompt are controlled.
-   Ground-truth evidence is validated.
-   Failed and incomplete runs are excluded or explicitly reported.
-   Results can be reproduced from saved configurations.
-   A sample of automated evaluation outputs is human-reviewed.

------------------------------------------------------------------------

## 16. Six-Week Implementation Roadmap

The schedule assumes the existing research implementation is
substantially functional. If the algorithm itself is still changing,
extend Week 1 and reduce optional UI scope.

### Week 1: Research audit and backend foundation

  -----------------------------------------------------------------------
  Task                                Deliverable
  ----------------------------------- -----------------------------------
  Audit existing library and          Function and dependency inventory
  configurations                      

  Verify all three chunking variants  Variant behavior tests

  Define adapter contracts            Pipeline interface

  Finalize evaluation protocol        Methodology document

  Set up FastAPI and configuration    Running backend

  Set up PostgreSQL and migrations    Working metadata schema

  Set up Qdrant and Redis             Healthy infrastructure

  Implement vault APIs                Vault CRUD
  -----------------------------------------------------------------------

**Acceptance criteria:** All three variants can be invoked through a
tested adapter on a small sample document. Infrastructure and migrations
work.

### Week 2: Parsing and ingestion engine

  -----------------------------------------------------------------------
  Task                                Deliverable
  ----------------------------------- -----------------------------------
  Implement file validation and       Safe upload service
  storage                             

  Implement parsing for initial       Parsed document representation
  formats                             

  Implement shared unit and embedding Reusable ingestion artifacts
  computation                         

  Implement three pipeline jobs       Three indexed variants

  Implement job state and retries     Observable ingestion lifecycle

  Implement deletion and re-indexing  Reliable document lifecycle
  -----------------------------------------------------------------------

**Acceptance criteria:** Upload a supported document and verify all
three collections contain the expected points and metadata. Test retry
and partial failure.

### Week 3: Retrieval and generation

  Task                                      Deliverable
  ----------------------------------------- ---------------------------------
  Implement query embedding and retrieval   Retrieval service
  Implement context assembly                Bounded, traceable context
  Implement model provider abstraction      Ollama and optional provider
  Implement answer generation               Working RAG response
  Implement streaming                       Streaming chat API
  Implement retrieval comparison            Side-by-side retrieval endpoint
  Persist conversation and metrics          Query history

**Acceptance criteria:** The same query can be executed against all
three pipelines with traceable retrieved evidence and saved results.

### Week 4: Frontend and visualization

  Task                                   Deliverable
  -------------------------------------- -----------------------------
  Build navigation and layout            Workbench shell
  Build chat interface                   Functional chat
  Build vault and upload UI              Document management
  Build retrieval inspector              Chunk inspection
  Build chunk visualizer                 Visible boundary comparison
  Integrate streaming and job progress   Complete application flow

**Acceptance criteria:** A user can create a vault, upload a document,
inspect three chunking outputs, and query each pipeline.

### Week 5: Benchmark and evaluation

  -----------------------------------------------------------------------
  Task                                Deliverable
  ----------------------------------- -----------------------------------
  Prepare benchmark dataset           Versioned evaluation data

  Validate questions and evidence     Ground-truth review

  Implement evaluation runner         Repeatable benchmark execution

  Implement retrieval metrics         Retrieval score reports

  Implement generation metrics        Answer-quality reports

  Implement faithfulness and claim    Hallucination-related results
  assessment                          

  Record latency and overhead         Performance report

  Save experiment metadata            Reproducible experiment history
  -----------------------------------------------------------------------

**Acceptance criteria:** Run the same benchmark across all three
pipelines and produce per-question and aggregate results with saved
configurations.

### Week 6: Analytics, hardening, and deployment

  -----------------------------------------------------------------------
  Task                                Deliverable
  ----------------------------------- -----------------------------------
  Build comparison dashboard          Research analytics

  Add experiment history and export   Reproducibility UI

  Add security and error handling     Hardened application

  Complete unit and integration tests Test report

  Complete Docker deployment          Reproducible deployment

  Prepare README and architecture     Developer documentation
  documentation                       

  Prepare research demonstration      Final-year presentation
  -----------------------------------------------------------------------

**Acceptance criteria:** A clean deployment can ingest a document, run
queries, execute an evaluation, display comparisons, and reproduce a
saved experiment.

------------------------------------------------------------------------

## 17. Risk Register

  -----------------------------------------------------------------------
  Risk                    Impact                  Mitigation
  ----------------------- ----------------------- -----------------------
  Existing library API    Adapter integration     Audit signatures and
  differs from plan       delays                  test before web
                                                  development

  Baselines accidentally  Invalid research        Variant contracts and
  use STP signals         comparison              isolation tests

  Benchmark labels are    Weak evaluation         Human-validated
  unreliable              conclusions             questions and evidence

  LLM evaluator bias      Misleading quality      Human review, evaluator
                          scores                  documentation, multiple
                                                  checks

  BGE-M3 is               Slow ingestion          Shared model process,
  resource-intensive                              caching, bounded
                                                  concurrency

  Ollama is unavailable   Generation failures     Provider abstraction
                                                  and clear failure state

  Qdrant collections      Operational overhead    Collection lifecycle
  proliferate                                     automation

  Background jobs are     Inconsistent index      Idempotent jobs and
  duplicated              state                   deterministic point IDs

  Parser cannot extract a Missing content         Explicit warnings and
  file                                            supported-format
                                                  validation

  Prompt injection in     Unsafe model behavior   Treat retrieved content
  documents                                       as untrusted

  Timeline overrun        Incomplete deliverable  Prioritize core
                                                  research and reduce
                                                  optional UI scope

  Evaluation runs are not Weak academic evidence  Version datasets,
  reproducible                                    models, configs, and
                                                  artifacts
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 18. Scope Prioritization

### Must-have

-   Three correctly isolated chunking pipelines.
-   Persistent Qdrant indexing.
-   Document and vault management.
-   RAG retrieval and generation.
-   Retrieval inspection.
-   Benchmark dataset and evaluation runner.
-   Retrieval and generation metrics.
-   Latency and chunk statistics.
-   Experiment configuration and history.
-   Docker-based deployment.
-   Automated tests for core research behavior.

### Should-have

-   Chunk-boundary visualization.
-   Context propagation visualization.
-   Hallucination-related claim evaluation.
-   Streaming chat.
-   Evaluation result export.
-   Historical experiment comparison.
-   Authentication for multiple users.

### Could-have

-   OCR for scanned PDFs.
-   Advanced role-based access control.
-   Cloud object storage.
-   Multi-node deployment.
-   Advanced tracing and observability.
-   Additional chunking baselines.
-   Multimodal retrieval.

If the schedule becomes constrained, postpone Could-have items before
compromising benchmark quality or the correctness of the three
pipelines.

------------------------------------------------------------------------

## 19. Final Project Deliverables

1.  **STP-RAG research library:** Reusable implementation of the
    proposed method and baseline variants.
2.  **Web application:** Vaults, uploads, chat, retrieval inspection,
    and chunk visualization.
3.  **Evaluation engine:** Versioned benchmark execution and
    quantitative metrics.
4.  **Benchmark dataset:** Questions, reference answers, and evidence
    annotations.
5.  **Experiment records:** Configurations, model versions, raw results,
    and aggregate metrics.
6.  **Deployment setup:** Docker Compose configuration and reproducible
    startup instructions.
7.  **Technical documentation:** Architecture, API contracts, setup, and
    testing.
8.  **Research report:** Methodology, experimental conditions, results,
    limitations, and conclusions.
9.  **Demonstration:** A reproducible end-to-end comparison of all three
    pipelines.

------------------------------------------------------------------------

## 20. Definition of Done

The project is ready for final demonstration when:

-   A user can create a vault and upload supported documents.
-   The system processes the document through all three pipelines.
-   Each pipeline indexes into its correct persistent collection.
-   The user can inspect chunk boundaries and metadata.
-   The user can query each pipeline independently.
-   Retrieved evidence is traceable to its source document.
-   The system generates and saves answers with pipeline metadata.
-   A versioned benchmark can be executed across all three pipelines.
-   Retrieval, generation, faithfulness, and performance metrics are
    reported with documented definitions.
-   Evaluation configurations and outputs are saved for reproduction.
-   The dashboard presents actual experiment results, not sample values.
-   Core ingestion, retrieval, deletion, and evaluation flows pass
    automated tests.
-   The application can be deployed from documented Docker instructions.

------------------------------------------------------------------------

## 21. Final Architectural Recommendation

Build this as an **STP-RAG Research and Evaluation Platform**, not
merely a chatbot with an analytics page.

The central project narrative should be:

1.  Identify a limitation in conventional RAG chunking.
2.  Define STP-RAG as the proposed adaptive chunking and
    context-propagation method.
3.  Implement fixed-size and semantic-similarity baselines.
4.  Compare all methods under controlled conditions.
5.  Measure retrieval quality, answer quality, faithfulness,
    hallucination-related behavior, and computational overhead.
6.  Provide a visual platform for inspecting and reproducing the
    results.

The most important engineering rule is that the research methodology
must drive the software architecture. The UI should make the research
understandable, while the benchmark and experiment records provide the
evidence.

**Priority before implementation:** Audit the existing `stp_rag/`
library, verify the exact behavior of all three variants, and finalize
the benchmark and evaluation protocol. Only then should web application
integration begin.
