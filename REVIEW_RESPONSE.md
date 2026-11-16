# Revision response: STP-RAG

This document records how `paper-review-2026-09-21-090140.tex` and the guide's requested revisions were handled in `STP_RAG_Research_Paper_Revised.tex`. It distinguishes completed manuscript changes from experimental work that cannot be completed from the files currently available.

## Guide requests

| Request | Action in revised manuscript |
|---|---|
| Abstract of 250--300 words in one paragraph | Rewritten as one 284-word paragraph covering the problem, objective, methodology, findings, numerical results, relative percentage changes, and evidence limitations. |
| Four or five keywords | Reduced to five focused keywords. |
| Stronger introduction | Reorganized into explicit background, research gap/problem statement, objective/motivation, research questions, significance/scope, and paper organization. |
| Stronger literature review | Added classical lexical-cohesion segmentation, C99, TopicTiling, neural segmentation, kernel change-point detection, segmentation metrics, and a limitations-focused comparison table. |

## Reviewer concerns addressed in the paper

| Reviewer concern | Manuscript action |
|---|---|
| Method is underspecified | Added a reference reconstruction with sentence units, unit-index progression, positive acceleration, volatility initialization, structural-vector definition, boundary rules, bidirectional context candidates, deterministic ranking, provenance, and token-budget requirements. |
| Method may not match the reported runs | Added a dedicated artifact-status subsection stating that the legacy aggregates cannot be verified against the reference reconstruction. |
| Evaluation population is undefined | Added an explicit missing-information table and reconstruction requirements for document/question counts, split IDs, corpus scope, filtering, scoring, and relevance mapping. |
| Index size and prompt length confound comparisons | Added matched-index-token, matched-retrieval-token, and matched-prompt-budget controls, plus equal-length context baselines. |
| STP components are not isolated | Added required velocity+volatility, velocity+structure, no-structure, and structure-only ablations; selective context must be applied across chunkers. |
| Statistical claims are unauditable | Removed the quoted bootstrap intervals and all significance claims. The Results section now states that seed standard deviations are not question/document uncertainty. |
| HotpotQA context gain lacks a demonstrated mechanism | Added required evidence coverage, context precision, prompt length, truncation, and qualitative success/failure analysis. |
| Closest segmentation literature is missing | Added TextTiling, C99, TopicTiling, supervised/neural segmentation, change-point detection, and WindowDiff literature and baselines. |
| RQ3 overinterprets dataset differences | Reframed RQ3 as a descriptive context-effect reversal and explicitly rejected a causal structure interpretation. |
| Paper reads as an editorial reconstruction | Reframed the numerical section as preliminary aggregate evidence and stated that confirmatory claims require the implementation, manifests, configurations, logs, and predictions. |
| Result tables appear in Methodology | Moved both result tables to the Results section after the reconstruction protocol and metric requirements. |
| Architecture does not identify context timing | Revised the caption and method to require disclosure of whether context changes indexed embeddings or only the generator prompt. |
| Only historical/preceding context is considered | The reference reconstruction considers both preceding and following context candidates. |
| Nonstandard IEEE layout | Replaced the custom one-column `IEEEtran` plus `geometry` combination with a neutral single-column `article` project-manuscript format. A venue submission must use that venue's official template. |

## Experimental work still required

The following cannot be truthfully repaired through manuscript editing because the needed source artifacts are absent:

1. Recover or rerun the implementation with exact frozen parameters and model revisions.
2. Provide dataset manifests, sample counts, retrieval populations, and benchmark scoring code.
3. Release per-query predictions and compute paired, document-aware uncertainty.
4. Run matched-index, matched-retrieval, and matched-prompt-budget comparisons.
5. Add component-wise STP and equal-budget context controls.
6. Add competitive segmentation baselines and segmentation-quality metrics.
7. Provide qualitative boundaries, selected-context examples, and mechanism diagnostics.

The revised paper does not claim these experiments have been completed. Adding invented values would directly contradict the review's reproducibility concerns.

## Implementation-audit integration

The later `STP_RAG_COMPREHENSIVE_AUDIT_REPORT.md` supplies concrete code-level findings that replace several earlier ``unknown'' statements:

- HotpotQA uses 150 constructed documents, 150 queries, and a 1,500-paragraph index.
- QASPER uses 49 papers and 149 QA pairs, but 42 questions are dropped by evidence-alignment failure, leaving 107 retrieval queries.
- Generation EM/F1 is capped at 25 questions per dataset; one exact answer changes EM by 0.04.
- The nominal velocity-only arm retains structural weight and is relabeled in the discussion as a nominal/contaminated baseline.
- Fixed top-3 retrieval produces substantially different prompt-token volumes across methods.
- The three seed runs are deterministic pseudo-replicates; the seed-level bootstrap is invalid.
- Encoder settings conflict between configuration and precomputation defaults, model revisions are unpinned, and per-query predictions are discarded.

These findings are now cited as an internal technical audit and integrated into the abstract, implementation section, results interpretation, limitations, and confirmatory evaluation protocol. The paper is compiled to exactly seven pages.