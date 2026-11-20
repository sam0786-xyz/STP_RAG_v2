# STP-RAG Comprehensive Audit, Scientific Critique, and Implementation Blueprint

**Document Type:** Rigorous Systems Audit & Empirical Reproducibility Report  
**Target Repository:** `DR_RAG` / `STP-RAG` (Capstone Project)  
**Evaluated Artifacts:** Core library (`stp_rag/`), configs (`configs/`), benchmark splits (`data/splits/`), experiment pipelines (`scripts/`, `notebooks/`), empirical results (`results/`), and IEEE manuscript (`STP_RAG_IEEE_Paper.md`, `FINAL_REPORT.md`).  
**Date:** September 2026  

---

## Executive Summary

This report delivers a rigorous, publication-grade audit of the **STP-RAG** codebase against the seven foundational critique criteria for empirical RAG and text-segmentation research. 

While the fundamental mathematical foundations of the Semantic Transition Profile (STP)—specifically the kinematics ($v, a, \sigma$) and the boundary probability formulation—are cleanly formulated in [`stp_rag/profile/stp.py`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/profile/stp.py) and [`stp_rag/chunking/segment.py`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/chunking/segment.py), our deep-dive analysis reveals **critical experimental confounds, statistical invalidities, and reproducibility gaps** in the current evaluation pipeline:

1. **Deterministic Pseudo-Replication & Spurious Bootstrap (Item 6):** The reported standard deviations across seeds ($s \in \{42, 123, 999\}$) are identically `0.000` because the pipeline is entirely deterministic. The 10,000 paired bootstrap resamples in [`99_master_results_compilation.ipynb`](file:///c:/Users/rajee/Desktop/capstone%20project/notebooks/99_master_results_compilation.ipynb) resampled across $n=3$ identical scalar seed results rather than across paired query/document evaluation instances, generating artificial confidence intervals and invalid statistical claims.
2. **Severely Constrained Generation Evaluation (Item 2):** While 150 HotpotQA documents and 49 QASPER papers exist in the test splits, downstream QA generation was arbitrarily truncated to only **25 queries** (`max_eval_queries: 25` in [`configs/eval.yaml`](file:///c:/Users/rajee/Desktop/capstone%20project/configs/eval.yaml)), meaning reported EM/F1 metrics have an unacceptable standard error ($\approx \pm 8\%$).
3. **Severe Token Budget Confounding (Item 3):** Methods were compared using fixed chunk rank ($k=3$ passages passed to the LLM) rather than matched prompt-token budgets. Fixed-size chunks averaged ~300–350 tokens/chunk, while Full STP averaged ~95–121 tokens/chunk. Consequently, Fixed-Size provided 3× more evidence tokens in the LLM prompt, explaining why Fixed-Size heavily outperformed Full STP on QASPER (Recall@5 0.379 vs. 0.299, F1 0.132 vs. 0.105), while Full STP + Context benefited from context expansion that baselines were denied.
4. **Missing Per-Query Artifacts and Model Revisions (Item 1):** The pipeline discards all per-query outputs in memory. Only summary scalar JSONs exist in [`results/`](file:///c:/Users/rajee/Desktop/capstone%20project/results/). Exact model git revisions, tokenizer checkpoints, and Ollama digest tags are unpinned.
5. **Ablation Confounding & Missing Baselines (Items 4 & 5):** The `velocity_only` arm silently retains structural boundary weights ($w_s$), context propagation was only applied to Full STP, and competitive baselines (TextTiling, C99, Percentile Semantic Chunkers) are absent.
6. **Absence of Mechanism Diagnostics (Item 7):** Zero intrinsic boundary quality metrics ($P_k$, $\text{WindowDiff}$), evidence cleavage rates, or context precision ratios are currently computed.

Below is the exhaustive, component-by-component analysis and concrete release roadmap addressing all seven points.

---

## 1. Executable Implementation, Exact Configuration, Manifests, Model Revisions, and Per-Query Predictions

### 1.1 Current Codebase Audit

| Sub-Component | Current Status | Location in Codebase | Identified Flaw / Gap |
|---|---|---|---|
| **Core Library** | Partially Complete | [`stp_rag/`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/) | Modular and importable, but tightly coupled to hardcoded local endpoints and unpinned library versions. |
| **Config Checksum** | Implemented | [`configs/stp_params.yaml`](file:///c:/Users/rajee/Desktop/capstone%20project/configs/stp_params.yaml), [`.sha256`](file:///c:/Users/rajee/Desktop/capstone%20project/configs/stp_params.sha256) | Verified at runtime in [`pipeline.py:108-115`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/experiments/pipeline.py#L108-L115). However, no checksums exist for dataset splits, index manifests, or prompt templates. |
| **Embedding Model** | Ambiguously Specified | [`configs/retrieval.yaml:1`](file:///c:/Users/rajee/Desktop/capstone%20project/configs/retrieval.yaml#L1) vs. [`pipeline.py:48`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/experiments/pipeline.py#L48) | Config specifies `"BAAI/bge-small-en-v1.5"`, but defaults in `precompute_corpus_embeddings` specify `"BAAI/bge-m3"`. No HuggingFace git commit hash is recorded. |
| **Generator Model** | Unpinned Tag | [`configs/retrieval.yaml:15`](file:///c:/Users/rajee/Desktop/capstone%20project/configs/retrieval.yaml#L15) | `"phi3:mini"` via Ollama. Fails to record quantization level (e.g., `Q4_K_M`), parameter count (3.8B), context window size `num_ctx`, or Ollama manifest sha256. |
| **Per-Query Predictions** | **COMPLETELY MISSING** | [`pipeline.py:259-268`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/experiments/pipeline.py#L259-L268) | Predictions are held in ephemeral Python lists, scored in aggregate via [`compute_qa_metrics()`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/eval/answer_metrics.py#L51), and **immediately discarded**. Only aggregate `em` and `f1` are persisted to `results/*.json`. |

### 1.2 The Per-Query Persistence Gap
In [`stp_rag/experiments/pipeline.py:259-276`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/experiments/pipeline.py#L259-L276):
```python
predicted_answers = []
evaluated_gold_answers = []
for q_idx in eval_query_indices:
    q_text = queries[q_idx]
    top_cids = retrieved_chunk_ids[q_idx][:3]
    retrieved_contexts = [chunk_map[cid].augmented_text for cid in top_cids if cid in chunk_map]
    ans, _ = generator.generate(q_text, retrieved_contexts) # Exact prompt is ignored!
    predicted_answers.append(ans)
    evaluated_gold_answers.append(gold_answers[q_idx])

# Only aggregate scalar floats are written!
em, f1 = compute_qa_metrics(predicted_answers, evaluated_gold_answers)
arm_result = ArmResult(..., em=float(em), f1=float(f1), ...)
write(arm_result, results_dir=results_dir)
```
No external researcher or reviewer can verify which questions succeeded or failed, whether hallucinations occurred, or how chunk boundaries affected specific answers.

### 1.3 Exact Remedy & Implementation Specification
To achieve gold-standard scientific reproducibility, the pipeline must be refactored to emit structured **JSONL per-query prediction manifests**:

```python
@dataclass
class QueryPredictionRecord:
    query_id: str
    doc_id: str
    question: str
    gold_answers: List[str]
    gold_chunk_ids: List[int | str]
    retrieved_chunk_ids: List[int | str]
    retrieved_chunk_scores: List[float]
    prompt_tokens: int
    prompt_text: str
    raw_generation: str
    normalized_prediction: str
    exact_match: float
    f1_score: float
    recall_at_1: float
    recall_at_5: float
    mrr: float
```

Files must be persisted to:
`results/{corpus}/predictions/{system}__seed{seed}__{split}_predictions.jsonl.gz` accompanied by a cryptographic manifest `manifest.sha256` capturing:
- Dataset files (`dev.json`, `test.json`)
- Model configurations and checkpoints
- Parameter files (`stp_params.yaml`)
- Per-query predictions and aggregated metrics

---

## 2. Fully Specified Evaluation Populations and Retrieval Corpora

### 2.1 Current Split Audit and Discrepancies

| Benchmark | Document Population | Query Population | Retrieval Corpus Size | Eval Query Choke-point | Dropped Queries |
|---|---|---|---|---|---|
| **HotpotQA** | 150 synthetic docs (10 Wiki paragraphs each) | 150 multi-hop queries (50% bridge, 50% comparison) | 1,500 paragraphs (~160k tokens) | **25 queries** (`max_eval_queries`) | 0 queries |
| **QASPER** | 49 full scientific papers (arXiv NLP/AI) | 149 QA pairs (extractive, free-form, yes/no) | 49 papers (~290k tokens) | **25 queries** (`max_eval_queries`) | **42 queries silently dropped** (matching failure) |

### 2.2 Deep Flaws in Corpus Preparation

1. **The 25-Query Evaluation Choke-point:**
   In [`configs/eval.yaml:14`](file:///c:/Users/rajee/Desktop/capstone%20project/configs/eval.yaml#L14), `max_eval_queries: 25`. While all 150 HotpotQA queries run through retrieval, only 25 queries are sent to Ollama for generation evaluation. With $N=25$:
   - A difference of 1 correct question changes EM by $1/25 = 0.040$ (+4.0 percentage points).
   - In Table 2 of the paper, Full STP has $\text{EM} = 0.120$ (3/25 correct), while Full STP + Context has $\text{EM} = 0.240$ (6/25 correct).
   - This difference of exactly 3 questions is claimed as a statistically significant "+20% relative improvement"!
2. **QASPER Query Dropping:**
   In [`stp_rag/experiments/pipeline.py:221-243`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/experiments/pipeline.py#L221-L243):
   ```python
   if not matching_cids:
       # Do NOT fall back to whole doc; drop unmappable query to avoid false 1.0 Recall/MRR
       continue
   ```
   Because gold evidence in QASPER consists of long multi-sentence character spans or free-form strings, naive substring checks (`gs.lower() in c_text_lower`) failed for 42 out of 149 queries. These 42 queries were dropped from retrieval evaluation entirely, skewing the reported denominator from 149 to 107.
3. **Corpus Distractor Density:**
   The HotpotQA corpus indexes only 150 documents (1,500 paragraphs). In standard open-domain or distractor RAG evaluations (e.g., KILT or standard HotpotQA distractor), each question is evaluated against a fixed corpus containing negative distractors across all questions. In the current setup, 150 questions compete over an index of 1,500 paragraphs, which is an artificial toy scale compared to standard benchmarks.

### 2.3 Required Evaluation Split Protocol
- **Adequately Sized Split:**
  - HotpotQA: Standardize on $N = 1,000$ test queries stratified by `bridge` (500) and `comparison` (500). Full corpus retrieval over all 10,000 paragraphs.
  - QASPER: Full official dev/test split across all 416 papers and 1,461 questions.
- **Robust Evidence Alignment:**
  Replace substring matching with character-span interval intersection or token-overlap Jaccard similarity ($\ge 0.70$) so zero valid queries are dropped.
- **Uncapped Generation:**
  Remove `max_eval_queries: 25`; evaluate generation across the complete test population.

---

## 3. Matched Index, Retrieval, and Prompt-Token Budgets

### 3.1 The Confounded Budget Architecture
The core claim of STP-RAG is that kinematic segmentation produces superior representations for retrieval and generation. However, the current experimental design conflates **segmentation policy** with **information quantity (token volume)**.

```
+-----------------------------------------------------------------------------------------+
| UNMATCHED TOKEN BUDGETS IN CURRENT PIPELINE                                             |
+-----------------------------------------------------------------------------------------+
| Arm                   | Avg Chunk Size  | Top-3 Chunks in Prompt | Effective Context    |
|-----------------------|-----------------|------------------------|----------------------|
| Fixed-size (400 tok)  | ~320 tokens     | 3 chunks               | ~960 tokens          |
| Full STP (Adaptive)   | ~115 tokens     | 3 chunks               | ~345 tokens (64% less!)|
| Full STP + Context    | ~115 + 200 tok  | 3 chunks + propagated  | ~945 tokens          |
+-----------------------------------------------------------------------------------------+
```

### 3.2 Consequences of Unmatched Budgets
1. **On QASPER (Scientific Papers):**
   Fixed-size chunks achieved Recall@5 of **0.379**, beating Full STP's **0.299**! Why? Because 5 fixed-size chunks delivered $\approx 1,600$ tokens of evidence to the retrieval scorer, whereas 5 Full STP chunks delivered only $\approx 550$ tokens. Full STP fragmented the scientific papers into 48 chunks/doc (~95 tokens/chunk), severing multi-paragraph proofs and experimental methodologies.
2. **On HotpotQA (Downstream Generation):**
   Table 2 reports F1 jumping from **0.283** (Full STP) to **0.410** (Full STP + Context). However, Full STP provided only 3 small chunks (~345 tokens) to Ollama, starving the generator of context. Full STP + Context appended preceding units, bringing the token budget up to ~950 tokens. The performance leap is therefore **an artifact of token volume**, not necessarily semantic topic partitioning!

### 3.3 The Controlled Equal-Budget Protocol

To isolate algorithmic chunking quality from prompt capacity, all methods must be evaluated under three strictly matched budget regimes:

```mermaid
flowchart LR
    A[Retrieved Candidates] --> B{Budget Controller}
    B -->|Regime 1: Matched Index Budget| C[Equal Total Chunks per Corpus]
    B -->|Regime 2: Matched Retrieval Budget| D[Recall@Tokens: 500, 1000, 1500 tokens]
    B -->|Regime 3: Matched Prompt Budget| E[Knapsack Pack into B_prompt: 512, 1024, 2048 tokens]
```

1. **Matched Prompt-Token Budget ($B_{\text{prompt}} \in \{512, 1024, 2048\}$):**
   Pass retrieved chunks to the LLM by greedy knapsack packing until the token budget $B_{\text{prompt}}$ is filled. A method with small chunks gets more chunks; a method with large chunks gets fewer chunks, but both supply the **exact same token budget** to the generator.
2. **Matched Retrieval-Token Budget ($B_{\text{retrieval}} \in \{500, 1000, 2000\}$):**
   Calculate Recall@$B$ where $B$ is cumulative text tokens retrieved, eliminating chunk-granularity bias.
3. **Matched Granularity Baselines:**
   Benchmark Fixed-Size at multiple sizes: $\text{Fixed}_{100}$, $\text{Fixed}_{250}$, $\text{Fixed}_{400}$ to directly match the average chunk length produced by Full STP.

---

## 4. Component-Wise STP Ablations and Equal-Budget Context Controls

### 4.1 Critique of Existing Ablation Matrix
In [`stp_rag/chunking/variants.py`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/chunking/variants.py), the 6 ablation rows follow a strictly cumulative progression:
- `fixed_size`
- `similarity_threshold`
- `velocity_only`
- `velocity_acceleration`
- `full_stp`
- `full_stp_context`

#### Identified Flaws:
1. **Contaminated "Velocity-Only" Arm:**
   In [`variants.py:138`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/chunking/variants.py#L138):
   ```python
   boundary_weights = {"w_v": w_v, "w_a": 0.0, "w_sigma": 0.0, "w_s": w_s, "b": b}
   ```
   `w_s` (the structural feature weight) is **active**! Hence, this arm is not velocity-only; it is **Velocity + Document Structure**.
2. **No Isolated Component Evaluation:**
   What is the impact of acceleration alone? What is the impact of volatility alone? What is the impact of structural cues alone? The current design cannot answer these questions.
3. **Uncontrolled Context Propagation:**
   Selective context propagation was added **only** to Full STP. We do not know whether applying context propagation to Fixed-Size or Similarity-Threshold chunking would yield equal or greater gains.

### 4.2 Proposed Factorial Ablation Matrix

#### Table 4.1: Component-Wise Signal Decomposition
Every signal is tested in isolation and in leave-one-out configurations against the full model under identical fixed token budgets:

| Ablation Arm | Velocity ($v$) | Acceleration ($a$) | Volatility ($\sigma$) | Structure ($S$) | Adaptive Budget ($T_i$) | Research Question Tested |
|---|:---:|:---:|:---:|:---:|:---:|---|
| **Fixed-Baseline** | — | — | — | — | — | Naive length baseline |
| **Structure-Only** | — | — | — | ✓ | — | Value of headings/lists alone |
| **Pure Velocity** | ✓ | — | — | — | — | Kinematic displacement rate |
| **Pure Acceleration** | — | ✓ | — | — | — | Transition rate change alone |
| **Pure Volatility** | — | — | ✓ | — | — | Local variance alone |
| **Kinematics-Only** | ✓ | ✓ | ✓ | — | — | STP without structural heuristics |
| **Full Boundary (Fixed Budget)**| ✓ | ✓ | ✓ | ✓ | — | STP boundary with constant chunk length |
| **Full STP (Boundary + Budget)**| ✓ | ✓ | ✓ | ✓ | ✓ | Full proposed method |

#### Table 4.2: Cross-Chunker Context Propagation Controls
A balanced $2 \times 3$ factorial design testing whether context propagation benefits are unique to STP:

| Chunker Base | No Context Augmentation | Naive Preceding Window (Equal Tokens) | Selective Context Propagation ($\tau_R, H_i$) |
|---|:---:|:---:|:---:|
| **Fixed-Size** | Baseline | Control A | Control B |
| **Similarity-Threshold** | Baseline | Control A | Control B |
| **Full STP** | Baseline | Control A | **Full STP + Context** |

---

## 5. Competitive Text-Segmentation and Semantic-Chunking Baselines

### 5.1 Current Deficit
The codebase currently compares STP against only two baselines:
1. `fixed_size`: A rigid token counter splitting at $L_{\max}$.
2. `similarity_threshold`: A greedy cosine distance threshold ($d_i > \tau_{\text{sim}}$).

Neither represents modern competitive baselines from the NLP or IR literature.

### 5.2 Required Competitive Baselines (Under Identical BGE Encoder)

To substantiate claims in a top-tier venue, STP must be benchmarked against:

```
+-----------------------------------------------------------------------------------------+
| COMPETITIVE SEGMENTATION & CHUNKING BASELINES                                           |
+-----------------------------------------------------------------------------------------+
| Baseline Family       | Method Name       | Description & Operational Mechanism         |
|-----------------------|-------------------|---------------------------------------------|
| **Lexical Cohesion**  | **TextTiling**    | Hearst (1997): Computes lexical cohesion     |
|                       |                   | valleys via block comparisons and depth     |
|                       |                   | scoring. Standard baseline for discourse.   |
| **Divisive Matrix**   | **C99**           | Choi (2000): Cosine similarity matrix       |
|                       |                   | transformed via local ranking and divisive  |
|                       |                   | clustering over sentence boundaries.        |
| **Semantic Distance** | **Percentile**    | Kamradt / LangChain SemanticChunker:        |
|                       | **SemanticSplit** | Calculates consecutive embedding distances, |
|                       |                   | splitting at dynamic 90th/95th percentiles. |
| **Structural/Layout** | **Hierarchical**  | LangChain / LlamaIndex MarkdownSplitter:    |
|                       | **Markdown**      | Recursively splits on H1, H2, H3, paragraph |
|                       |                   | breaks with 15% sliding window overlap.     |
| **Propositional**     | **Dense**         | Chen et al. (2023): Segments text into      |
|                       | **Propositions**  | atomic, self-contained factual statements.  |
+-----------------------------------------------------------------------------------------+
```

### 5.3 Controlled Environment Guarantee
Every baseline must share:
- Encoder: `BAAI/bge-small-en-v1.5` (normalized embeddings)
- Vector Store: Qdrant in-memory dense index with cosine distance
- Retrieval Depth: Matched token budget ($B_{\text{retrieval}} = 1000$ tokens)
- Downstream Generator: `phi3:mini` at `temperature = 0.0`

---

## 6. Uncertainty Estimation Over Paired Query/Document Units

### 6.1 The Seed-Resampling Fallacy in the Current Repository
In [`notebooks/99_master_results_compilation.ipynb:426-435`](file:///c:/Users/rajee/Desktop/capstone%20project/notebooks/99_master_results_compilation.ipynb#L426-L435) and [`stp_rag/eval/compilation.py:129-160`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/eval/compilation.py#L129-L160):

```python
for arm in ARMS:
    arm_data = df[df['system'] == arm]
    for metric in METRICS:
        arm_vals = arm_data[metric].values # Length is 3! (seeds 42, 123, 999)
        base_vals = baseline_data[metric].values # Length is 3!
        if len(arm_vals) > 0 and len(base_vals) > 0:
            delta, ci, sig = compute_paired_bootstrap(arm_vals, base_vals, num_resamples=10000)
```

#### Why This Is Mathematically and Scientifically Invalid:
1. **Deterministic Execution:** The chunking algorithm, BGE embedding model, Qdrant search, and Ollama generator (at `temperature: 0.0`) are **100% deterministic**. The random seed `s` altered nothing in the pipeline.
2. **Identical Observations:** The results for seeds 42, 123, and 999 were identical to 4 decimal places (`0.410, 0.410, 0.410` vs. `0.344, 0.344, 0.344`).
3. **Resampling Degeneracy:** Running 10,000 bootstrap resamples on an array of three identical numbers ($[0.066, 0.066, 0.066]$) trivially produces a sample mean of $0.066$ and an artificial confidence interval of $[0.0658, 0.0688]$. This was claimed as "$p < 0.05$ statistical significance"!
4. In real empirical NLP/IR, random seeds do not represent the statistical population; **queries and documents are the true sampling units**.

### 6.2 Correct Statistical Formulation

```mermaid
flowchart TD
    A[Query Population Q = {q_1, ..., q_N}] --> B[Pairwise Metric Computation]
    B --> C["Δ_i = Metric(Arm, q_i) - Metric(Baseline, q_i)"]
    C --> D[Bootstrap Resampling B = 10,000]
    D --> E[Draw N queries with replacement]
    E --> F[Compute Mean Δ*]
    F --> G[Construct Empirical 95% CI: [Δ_0.025, Δ_0.975]]
    G --> H{Does 0 fall within CI?}
    H -->|Yes| I[Not Statistically Significant]
    H -->|No| J[Statistically Significant p < 0.05]
```

1. **Paired Query-Level Bootstrap (HotpotQA):**
   Let $q_i \in Q$ be the $i$-th query, with $N = |Q|$.
   For each query, compute $\Delta_i = M(\text{STP}, q_i) - M(\text{Baseline}, q_i)$.
   For $b = 1, \dots, 10{,}000$, sample $N$ indices with replacement:
   $$
   \bar\Delta^{(b)} = \frac{1}{N} \sum_{k=1}^N \Delta_{i_k}^{(b)}
   $$
   The 95% Bootstrap Confidence Interval is $[\bar\Delta_{(250)}, \bar\Delta_{(9750)}]$.
2. **Clustered Document Bootstrap (QASPER):**
   In QASPER, multiple questions belong to the same research paper. Because questions on the same document have correlated errors, standard query-level resampling underestimates variance. Resampling must occur at the **document/paper level**: sample $D$ papers with replacement, retaining all corresponding questions for the resampled papers.
3. **Non-Parametric Hypothesis Testing:**
   Accompany bootstrap CIs with the paired Wilcoxon signed-rank test and paired permutation test (10,000 permutations).

---

## 7. Mechanism-Focused Analyses

To provide scientific insight beyond top-line metric tables, the evaluation suite must measure five core mechanisms:

### 7.1 Intrinsic Boundary Quality ($P_k$ and $\text{WindowDiff}$)
Evaluate whether STP boundaries align with true topical and structural discourse transitions (e.g., section headers, thematic shifts) without relying on downstream retrieval.

$$
P_k = \sum_{i=1}^{N-k} \frac{| \delta_{\text{ref}}(i, i+k) - \delta_{\text{hyp}}(i, i+k) |}{N-k}
$$
$$
\text{WindowDiff} = \sum_{i=1}^{N-k} \frac{\mathbb{I}(|b_{\text{ref}}(i, i+k) - b_{\text{hyp}}(i, i+k)| > 0)}{N-k}
$$
- Where $k = \frac{1}{2} \times \text{average segment length}$. Lower scores indicate higher boundary fidelity.
- Include Boundary Precision, Boundary Recall, and Boundary F1 within a tolerance window of $\pm 1$ sentence.

### 7.2 Evidence Cleavage Rate
In multi-hop QA (HotpotQA) and scientific reasoning (QASPER), evidence often spans multiple consecutive sentences.
- **Evidence Cleavage:** Occurs when gold evidence sentences $\{s_1, s_2, s_3\}$ are partitioned into different chunks: $\{s_1\} \in c_A$ and $\{s_2, s_3\} \in c_B$.
- **Metric:**
  $$
  \text{Cleavage Rate} = \frac{\sum_{q \in Q} \mathbb{I}(\text{GoldEvidence}(q) \text{ split across } \ge 2 \text{ chunks})}{|Q|}
  $$
- Hypothesis: Full STP significantly reduces evidence cleavage compared to rigid fixed-size chunking.

### 7.3 Context Precision vs. Noise Contamination
Measure the proportion of retrieved tokens that directly constitute gold supporting facts:
$$
\text{Token Context Precision} = \frac{\sum_{c \in \text{Retrieved}} |\text{Tokens}(c) \cap \text{GoldEvidenceTokens}|}{\sum_{c \in \text{Retrieved}} |\text{Tokens}(c)|}
$$
This diagnoses whether high Recall is achieved by retrieving bloated chunks (diluting context with distractor noise) or compact, high-density passages.

### 7.4 Prompt Length Economics
Plot downstream generation accuracy (EM / F1) against total prompt token consumption.
- Generates the **Quality-Token Pareto Curve**.
- Demonstrates whether STP achieves higher token efficiency (more accurate answers per 1,000 input prompt tokens).

### 7.5 Success and Failure Case Taxonomy
Document representative failure and success modes:
1. **Kinematic Fragmentation Failure:** High semantic volatility in mathematical proofs or tabular data causing STP to over-segment text into tiny uninformative fragments.
2. **Context Bleed Failure:** Selective context propagation injecting semantically similar but factually distracting prior paragraphs, causing the LLM to hallucinate.
3. **Multi-Hop Synthesis Success:** STP detecting an abrupt topic shift and preserving the entire relational bridge premise in a single chunk, allowing Ollama to answer correctly where Fixed-Size failed.

---

## Action Plan & Implementation Roadmap

| Step | Phase | Key Deliverable | Files Impacted |
|---|---|---|---|
| **1** | Architecture & Schema | Implement `QueryPredictionRecord` schema and JSONL persistence. | [`stp_rag/eval/results_schema.py`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/eval/results_schema.py), [`pipeline.py`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/experiments/pipeline.py) |
| **2** | Token Budgeting | Implement Knapsack token packing ($B_{\text{prompt}}$) and Recall@Tokens. | [`stp_rag/generation/answer.py`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/generation/answer.py), [`stp_rag/retrieval/stage1_dense.py`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/retrieval/stage1_dense.py) |
| **3** | Unchoking Population | Remove `max_eval_queries: 25`, fix QASPER evidence span alignment, scale splits. | [`configs/eval.yaml`](file:///c:/Users/rajee/Desktop/capstone%20project/configs/eval.yaml), [`scripts/prepare_dataset_splits.py`](file:///c:/Users/rajee/Desktop/capstone%20project/scripts/prepare_dataset_splits.py) |
| **4** | Baselines & Ablations | Implement TextTiling, Percentile Chunker, clean `w_s` from velocity arm, add factorial controls. | [`stp_rag/chunking/variants.py`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/chunking/variants.py), [`stp_rag/chunking/baselines.py`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/chunking/baselines.py) |
| **5** | Rigorous Statistics | Replace 3-seed bootstrap with Paired Query & Clustered Document Bootstrap ($B=10{,}000$). | [`stp_rag/eval/compilation.py`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/eval/compilation.py), [`notebooks/99_master_results_compilation.ipynb`](file:///c:/Users/rajee/Desktop/capstone%20project/notebooks/99_master_results_compilation.ipynb) |
| **6** | Mechanism Analytics | Implement $P_k$, $\text{WindowDiff}$, cleavage rate, and token precision scorers. | [`stp_rag/eval/mechanism_metrics.py`](file:///c:/Users/rajee/Desktop/capstone%20project/stp_rag/eval/mechanism_metrics.py) |
| **7** | Manuscript Update | Update Table 2, Table 3, and discussion in LaTeX and Markdown with audited results. | [`STP_RAG_Overleaf_Package/`](file:///c:/Users/rajee/Desktop/capstone%20project/STP_RAG_Overleaf_Package/), [`STP_RAG_IEEE_Paper.md`](file:///c:/Users/rajee/Desktop/capstone%20project/STP_RAG_IEEE_Paper.md) |
