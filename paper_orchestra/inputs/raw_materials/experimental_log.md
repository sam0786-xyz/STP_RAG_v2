# STP-RAG evidence ledger

## Data status

This is an audited pilot, not a confirmatory benchmark. Aggregate values below
are copied from the repository's result tables. They are descriptive means with
across-seed standard deviations where supplied. There are no released per-query
predictions, paired confidence intervals, or hypothesis tests.

## Pilot patterns that may be reported

### HotpotQA

- Velocity-only answer F1: 0.344.
- Fixed-size answer F1: 0.358.
- Full STP with selective context answer F1: 0.410.
- Thus, full STP with context is +0.066 F1 over velocity-only and +0.052 over
  fixed-size on this pilot. These comparisons are not significance tests.
- Velocity-only has the strongest reported HotpotQA Recall@5 and MRR among the
  compared arms; do not say full STP wins every metric.
- HotpotQA mean retrieval latency ranges from 1.717 ms (fixed-size) to
  3.972 ms (similarity threshold). Timings are not end-to-end system latency
  and caching/timing boundaries are not documented.

### QASPER

- Fixed-size chunking is best on all four reported QASPER quality metrics.
- Full STP without selective context has F1 0.105; enabling selective context
  reduces F1 to 0.068.
- Full STP Recall@5 is 0.299 and velocity-only Recall@5 is 0.252; fixed-size
  Recall@5 is 0.379, so full STP is 21.1% below fixed-size chunking.
- Full STP has more chunks than velocity-only (47.959 vs. 41.796); do not claim
  fewer chunks or empirically demonstrated section preservation.
- QASPER mean retrieval latency ranges from 2.724 ms (fixed-size) to 6.902 ms
  (full STP with context). Fixed-size chunking is both the fastest and the most
  accurate arm on QASPER. The latency plot's horizontal bars are across-seed
  standard deviations (up to about 1.07 ms), so some bars extend past 7 ms.

## Audit constraints to include

- Generation metrics use only 25 queries.
- 42 of 149 QASPER questions are dropped during evidence alignment.
- The velocity-only baseline is structurally weighted, so it is not a clean
  velocity-only ablation.
- Retrieval arms differ in chunk count, indexed material, prompt/context token
  volume, and context attachment behavior.
- Every arm passed its top-3 chunks to the generator. Fixed-size chunks averaged
  about 300-350 tokens and full-STP chunks about 95-121 tokens, so the generator
  received roughly 960 evidence tokens for fixed-size, 345 for full STP and 945
  for full STP with context (audit estimates from mean chunk lengths, not
  per-query counts). The HotpotQA context gain is therefore consistent with
  restored prompt volume and must not be attributed to better context selection.
- The nominal velocity-only arm keeps its structural weight; call it
  "velocity + structure" when describing what it computes.
- Encoder version, exact structural processing, calibrated weights, generator
  decoding, retrieval backend, hardware, and per-query records are missing.

## Confirmatory protocol

Use matched document/question splits and record one JSONL row per query and
arm. Match chunk-length distributions and generator prompt budgets. Compare a
fixed-size baseline, similarity-threshold baseline, velocity-only without
structural cues, structure-only, velocity+volatility, velocity+structure, full
STP without structure, full STP, relevance-only context, and profile-guided
context. Evaluate Recall@K, MRR@10, EM/F1, P_k, WindowDiff, evidence split
rate, context precision/recovery, index size, build time, retrieval latency,
and prompt tokens. Use paired bootstrap or document-cluster bootstrap, a
sign-flip permutation test, and Holm correction.

## Available figures

- `pareto_latency_recall.png`: descriptive Recall@5 vs. mean retrieval latency.
- `delta_vs_baseline.png`: rounded mean deltas against velocity-only.
- `structure_breakdown.png`: chunk count vs. answer F1 by dataset.

Figures are descriptive; do not add significance marks or infer causal effects.
