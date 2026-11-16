# stp_eval: evaluation harness for the STP-RAG confirmatory protocol

This package implements Section 5 of `research_paper_v2/STP_RAG_Research_Paper_v2.tex`. It also contains a reference implementation of Algorithm 1 and Eqs. 1–9 from the same paper, so the confirmatory run can be checked against the specification.

It has **not** been run against the pilot `stp_rag/` system, and it produces no results by itself. It is the instrument for the confirmatory run.

Standard library only (Python 3.10+).

```bash
python3 -m unittest discover -s tests -t .      # 27 tests against hand-computed values
```

## What maps to what

| Module | Manuscript | Contents |
| --- | --- | --- |
| `profile.py` | Eqs. 1–6 | velocity, positive acceleration, volatility, robust scaling with the IQR → MAD → SD → 1 fallback, boundary probabilities |
| `segment.py` | Alg. 1, Eq. 7 | bounded segmentation; fixed-size and similarity-threshold baselines |
| `context.py` | Eqs. 8–9 | profile-guided horizons, transition barrier, budgeted greedy selection; `profile_guided=False` is the relevance-only control |
| `budget.py` | §5.2 | packing ranked chunks into a prompt budget (context counts; truncation at unit boundaries) |
| `metrics.py` | §5.4 | span credit, Recall@K, MRR@10, evidence split rate, context precision and recovery, SQuAD EM/F1 |
| `segmentation_metrics.py` | §5.4 | P_k, WindowDiff, boundary precision/recall with tolerance |
| `stats.py` | §5.5 | paired bootstrap, document-cluster bootstrap, sign-flip permutation test, Holm |
| `records.py` | §5.6 | per-query JSONL schema (gzip supported) and SHA-256 manifest |
| `report.py` | tooling | builds the run bundle the dashboard loads |

## Producing a dashboard bundle

Write one JSONL file per arm with `records.write_records`:

```text
runs/HotpotQA/fixed_matched.jsonl
runs/HotpotQA/full_stp_ctx.jsonl
runs/QASPER/fixed_matched.jsonl
...
```

Then build the bundle and load it on the dashboard's **Runs** page:

```bash
python3 -m stp_eval.report runs/ --baseline fixed_matched \
    --metrics recall@5 mrr@10 em f1 --cluster QASPER --out run_bundle.json
```

Comparisons are always paired: only queries present in both the arm and the baseline are used, and the count is reported. Datasets listed under `--cluster` use the document bootstrap and cluster-level sign flips. Holm adjustment is applied across arms within each metric.

## Conventions worth knowing

- Units are 0-indexed. A candidate boundary `i` cuts between unit `i-1` and unit `i`, so `pi[0]` is unused.
- In the forced-cut rule (Eq. 7), ties go to the later candidate. Context ties go to the nearer unit, then the earlier one.
- A document edge counts as a certain boundary (probability 1) when context horizons are computed.
- Spans are half-open `(start, end)` intervals. Credit and evidence splitting use character offsets. Pass token offsets to `context_precision` to get the token version reported in the paper.
