# STP-RAG manuscript v2: revision notes

Main file: `STP_RAG_Research_Paper_v2.tex` (11 pages including references). The v1 files in the parent folder are unchanged.

## What v2 does and does not contain

v2 is a full rewrite of the prose. It fixes the reviewer's technical findings and adds a confirmatory protocol. It contains **no new experimental results**. Every number comes from `data/pilot_summary_metrics.csv` (the audited pilot aggregates) or from the internal audit report. Nothing was rerun, because the `stp_rag/` code and raw outputs are not in this folder.

## Reviewer findings (review of 22 Sep 2026)

| # | Finding | Where v2 addresses it |
|---|---|---|
| 1 | Eq. 7 typo (`lambda_r`) and undefined quantities | §3.3, Eq. 9: every term is defined and bounded in [0, 1]. Chunk embedding $\bar e_i$ is defined (mean of unit embeddings, before augmentation). $\mathcal{H}_i$ is defined. Structural affinity is renamed $A$ to avoid the clash with $\mathbf{s}_i$. |
| 2 | Context policy did not use the profile | Eq. 8: horizons depend on the opening and closing boundary probabilities. Eq. 9 adds a transition-barrier term $T$. Setting $\lambda_t=0$ with fixed horizons defines the relevance-only control. |
| 3 | Figure 1 showed one placement while the text left it open | Figure 1 now draws branch A (augment, then index) and branch B (retrieve, then augment). The caption states which branch the pilot is consistent with, and why. |
| 4 | Procedure was not executable | Table 2 lists every parameter. Algorithm 1 is a real `algorithm` float with the cut convention, forced-cut rule (Eq. 7), tie-breaking and oversize-unit handling. |
| 5 | Median/IQR could degenerate | Eq. 4: IQR → 1.4826·MAD → SD → 1 fallback, with the requirement to report how often each fires. |
| 6 | Reference method and pilot not reconciled | New Table 3 maps 13 components to the pilot, each with a status. |
| 7 | "Deterministic" contradicted non-zero F1 SDs | §4: retrieval metrics and EM have zero SD everywhere, and only F1 varies, which fits retrieval being deterministic and generation not. The section says plainly that this is an inference that needs the raw per-seed files. |
| 8 | "Velocity-only" label was false | Relabelled "Velocity + structure" in every table, figure and sentence, with a footnote giving the legacy name. The "Velocity + acceleration" row carries a ‡ marking what is unverified. |
| 9 | Percentages read as confirmed improvements | Phrased as "reported relative increase in the 25-query pilot". EM shows absolute counts (k/25) in the tables and text. |
| 10 | Evaluation definitions insufficient | §5.1 and §5.4: span credit rule (θ = 0.5), Recall@K and MRR@10 equations, the rule that context earns no retrieval credit, the QASPER exclusion rate (42/149 = 28.2%) and its selection-bias risk. |
| Ed. | Algorithm numbered as a figure | Fixed (`algorithm` package). |
| Ed. | Profile vs Profiles; hyphenation | Title is "Semantic Transition Profile-Guided"; the body uses the singular. |
| Ed. | "Prespecified" claimed | Removed. §5 states that the manifest will be committed before the confirmatory run. |
| Ed. | TextTiling capitalisation | Already protected in the .bib; it renders correctly. |

v1 text defects also fixed: garbled abstract and research questions, a broken related-work table, unescaped `%` signs that silently deleted the rest of two paragraphs, missing `\section` commands, "21.1% faster" (it meant lower recall), and "full sized chunking" (it meant full STP).

## New material

- §5 confirmatory protocol: populations, budget regimes, a 9-arm factorial (Table 4), cross-chunker context controls, competitive baselines, mechanism metrics, four primary hypotheses with Holm correction, paired and document-clustered bootstrap, a sign-flip test and a planning-level sensitivity estimate.
- Table 7: the prompt-token account behind the HotpotQA context effect.
- The evaluation harness in `../stp_eval_harness/` (27 unit tests) implements §3 and §5. The paper says it has not been run on the pilot.

## Citation verification (16 Nov 2026)

- **Crossref DOI lookup**: all 13 DOIs in the bibliography resolve, and title, year and pages match. This includes the four references added in v2: Optuna, Dror et al. 2018, Rajpurkar et al. 2016, and Holm 1979 (no DOI; see below).
- **DataCite (arXiv DOIs)**: GraphRAG, Late Chunking, CRAG, C-Pack, M3-Embedding and Phi-3 resolve. Two titles had changed on arXiv, and v2 uses the current ones:
  - C-Pack is now "Packed Resources for General Chinese Embeddings".
  - BGE M3 is now "M3-Embedding: Multi-Linguality, …".
- **DOIs added** from Crossref: Beeferman et al. 1999 (10.1023/A:1007506220214) and Field & Welsh 2007 (10.1111/j.1467-9868.2007.00593.x).
- **Proceedings URLs**: RAG, RAPTOR, Self-RAG, TextTiling, C99, TopicTiling and the kernel change-point paper all return HTTP 200 with the matching title.
- **Not machine-verified**:
  - Holm (1979) is not indexed by Crossref, and JSTOR blocks automated lookups. The entry uses the standard citation (Scand. J. Statist. 6(2):65–70).
  - Efron & Tibshirani is cited as 1993. Crossref lists the CRC reprint as 1994.
  - `stpaudit2026` is your internal audit and cannot be checked externally.

No text was copied from any web source into the manuscript. The only material taken from external sources is the bibliographic metadata above, and every such source is cited.

## Originality and AI-writing check

- The prose is newly written for v2. It does not reuse v1 sentences, and no web text was copied in.
- Formulas for P_k, WindowDiff, SQuAD EM/F1, the bootstrap and Holm follow their cited sources.
- **avoid-ai-writing skill v3.38.0**: the deterministic detector ran on the extracted prose (4,461 words, technical context). Score 0, label "Clean", classification HUMAN_ONLY (high confidence), 0 issues, 0 em dashes.
- A manual catalog pass made three edits:
  - a "not X but Y" contrast in the introduction;
  - a self-labelled "most useful lesson" in the conclusion;
  - a "rather than another general statement" closer.
- **Limits of these checks**:
  - The skill's authors stress that detectors give signals, not proof.
  - No commercial plagiarism checker (Turnitin, iThenticate) was run, and none is available here.
  - Run your institution's checker and inspect individual matches, not only the total score.
  - Follow the target venue's rules on disclosing AI assistance.

## Build

```bash
python3 scripts/make_results.py          # regenerates results/*.tex and results/pilot_metrics.json from the CSV
latexmk -pdf STP_RAG_Research_Paper_v2.tex
```

The folder uploads to Overleaf as-is. Overleaf runs Biber automatically.

On this Mac, the TeX Live `biber` wrapper fails because its bundled `lipo` step breaks. The local build used an arm64 binary extracted with `/usr/bin/lipo -thin arm64`. Reinstalling biber with `tlmgr` should fix the wrapper.

## Six-page conference version (2026-11-16)

`STP_RAG_Research_Paper_v2.tex` is now an IEEE two-column conference paper (IEEEtran, A4) of six pages including references, to fit a six-page limit. The previous eleven-page single-column manuscript is kept unchanged as `STP_RAG_Research_Paper_v2_full.tex` / `.pdf`.

What was cut or condensed (no results, numbers or claims were added or changed):
- Related-work table (Table 1) removed; its content stays in the four related-work paragraphs.
- Parameter table (Table 2) replaced by one paragraph listing the reference values; the pilot column is covered by the reconciliation table.
- Reconciliation table reduced to Component / Pilot / Status; arms table reduced to its check-mark columns.
- The two pilot result tables merged into one full-width table (`results/table_pilot.tex`, generated by `scripts/make_results.py` from the same CSV).
- The results figure (differences from the velocity + structure arm) is kept as a full-width Fig. 2; the latency figure is removed and its numbers remain in the table and the text.
- Display equations for Recall@K and MRR replaced by a sentence; the audit and protocol paragraphs shortened.
- Bibliography printed without DOIs, months and notes to save space; every cited work is still listed.
