# Manuscript revision and result provenance

## Scope

The main file is `STP_RAG_Research_Paper_Revised.tex`. Following the September 22, 2026 peer review, it now uses a neutral single-column `article` layout rather than a custom one-column IEEE class. Numbered IEEE-style references are still produced with Biber. This is a project-manuscript format, not a claim of compliance with a specific venue. A submission version must adopt the selected venue's official template, anonymity policy, and page limit.

The implementation-audited revision is exactly seven pages with a 10-point body and 0.65-inch margins. The result tables retain all 168 supplied numeric values (12 rows × 7 metrics × mean/standard deviation). The bibliography contains 20 literature sources plus the internal implementation audit, with abbreviated author lists for readable script-sized references. Two result charts remain native PGFPlots figures; the redundant chunk-count/F1 chart was removed to meet the page limit because its conclusion is now stated directly. Compilation and visual inspection validate the manuscript build, transcription, and citations, not a rerun of the underlying experiments.

The abstract is a single 250--300-word paragraph with five keywords and relative percentage changes. The introduction identifies background, gap, problem, objectives, motivation, significance, and organization. Related work covers TextTiling, C99, TopicTiling, supervised and transformer segmenters, kernel change-point detection, and WindowDiff. The method is presented as a reference reconstruction. The attached comprehensive implementation audit is cited separately and supplies the actual pilot population, 25-query generation cap, QASPER alignment failures, token-budget imbalance, contaminated velocity baseline, deterministic-seed flaw, and missing model/prediction records.

## Supplied data and generated assets

- `results/table_hotpotqa.tex` and `results/table_qasper.tex` retain all 12 aggregate rows at the reported precision. Bold identifies the highest quality metric in each column, including ties; it does not designate an entire preferred method. These tables supply the values used to construct the native charts.
- `results/plot_delta.tex` draws differences of rounded means against velocity-only, without invented paired confidence intervals or significance markers.
- `results/plot_latency.tex` draws mean latency versus Recall@5 with across-seed standard-deviation error bars. Its frontier is descriptive, not an uncertainty-aware ranking.
- `results/plot_structure.tex` draws chunk count versus answer F1 by dataset. It does not imply that document-level structural categories were annotated.
- `results/plot_styles.tex` defines shared colors, marker shapes, labels, and compact chart sizing. All charts compile from these `.tex` files; no external figure PDFs, image placeholders, Python execution, or CSV files are needed.
- PNG exports and `generate_result_figures.py` from the earlier revision are auxiliary only. That Python script requires `results/summary_metrics.csv`, which is absent from the current workspace; it is not the build path for the current diagrams.

The experiment repository, notebooks, original plot files, configuration checksum, and 17-test execution log mentioned in the walkthrough were not uploaded. Local Windows file links in that walkthrough are not accessible project files. No experiments, bootstrap analysis, or implementation tests were rerun for this editorial revision.

## Corrections to the walkthrough's interpretation

1. Full STP does not uniformly outperform simpler methods. Fixed-size is best on all four QASPER quality metrics, and velocity-only has the strongest HotpotQA Recall@5 and MRR.
2. HotpotQA selective context improves F1 by 0.066 versus velocity-only and by 0.127 versus full STP without context. These are different comparisons.
3. QASPER selective context reduces F1 from 0.105 to 0.068. This negative result is retained.
4. QASPER full STP produces MORE chunks than velocity-only (47.959 versus 41.796), not fewer. No claim of empirically demonstrated section preservation is made.
5. Mean HotpotQA retrieval latency reaches 3.972 ms, not 3.2 ms. The largest reported mean build time is 1.969 s, not 1.5 s. These are not end-to-end timings, and a mean below 7 ms does not imply that every query takes less than 7 ms.
6. Chunk counts and latency differ substantially across arms. The data cannot establish that quality is independent of index growth, storage, or context-token budget.
7. The unreconstructable numerical bootstrap intervals and associated significance claims have been removed. The paper now requires paired query-level or document-clustered inference from released predictions.

## Required before submission

Supply document/question counts and split manifests; HotpotQA retrieval setting and candidate-corpus scope; QASPER scoring and unanswerable/multiple-reference handling; evidence-to-chunk relevance mapping; MRR cutoff; encoder/version; unit and progression definitions; volatility window and initialization; all calibrated weights and bounds; context ranking and budget; whether attachment changes embeddings or only the prompt; index backend; generator digest and decoding parameters; hardware; timing boundaries and caching conditions; configuration/checksum; and paired predictions. The mathematical description is condensed from the original framework and walkthrough and must be reconciled with the actual implementation rather than presented as a code audit.

Recompute uncertainty using paired observations, accounting for dependence among questions from the same document where appropriate. Specify the bootstrap statistic, confidence-interval construction, hypothesis test, and multiple-comparison procedure before asserting significance. A structure-disabled arm and matched-context-budget controls are needed for isolated causal claims about structure, volatility, and attachment.

## Reference check

Publication titles, authors, venues, pages, and available DOI records were checked against primary sources through September 22, 2026:

- RAG: NeurIPS 2020 proceedings record, `6b493230205f780e1bc26945df7481e5`.
- DPR: ACL Anthology `2020.emnlp-main.550`.
- Dense X: ACL Anthology `2024.emnlp-main.845`.
- RAPTOR and Self-RAG: ICLR 2024 proceedings records; the bibliography now follows the Self-RAG proceedings name “Avi Sil.”
- Adaptive-RAG: ACL Anthology `2024.naacl-long.389`.
- Lost in the Middle: ACL Anthology `2024.tacl-1.9`.
- HotpotQA: ACL Anthology `D18-1259`.
- QASPER: ACL Anthology `2021.naacl-main.365` (Dasigi et al., 2021), added for the actual evaluated dataset.
- Optuna: ACM publication DOI `10.1145/3292500.3330701`, added for calibration.
- GraphRAG, Late Chunking, and CRAG: arXiv `2404.16130`, `2409.04701`, and `2401.15884`. They are identified as preprints, not assigned unverified peer-reviewed venues. Later revision dates are noted for GraphRAG and Late Chunking.
- TextTiling: ACL Anthology `J97-1003`; C99: ACL Anthology `A00-2004`; TopicTiling: ACL Anthology `W12-3307`.
- Supervised/neural segmentation: ACL Anthology `N18-2075` and `2021.findings-emnlp.283`.
- WindowDiff: ACL Anthology `J02-1002`; kernel change-point detection: JMLR 20(162), 2019.

Source locators remain in `references.bib`; the formatted bibliography uses DOI links where available. Internal reports were not available for verification and are not used as research evidence in the revised paper.

## Originality and disclosure

The prose has been rewritten around the supplied results with explicit attribution and without borrowed passages. No plagiarism checker or AI-text detector was run. A similarity score below 5% or an AI-detection score below 5% cannot be promised or certified. Authors should review the prose for accuracy and their own voice, run the institution's permitted similarity check, inspect individual matches rather than just the total, and follow the target venue's applicable AI-assistance disclosure rules. Do not describe this editorial revision as proof of authorship or research validation.

## Build

Run `latexmk -pdf -interaction=nonstopmode -halt-on-error STP_RAG_Research_Paper_Revised.tex`. PGFPlots draws the result diagrams from the included `.tex` files, and TikZ draws the pipeline. Biber, rather than BibTeX, handles the bibliography. Python and standalone image files are not required for compilation.