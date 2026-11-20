# STP-RAG: start here

**STP-RAG** (Semantic Transition Profile-guided adaptive chunking and selective context for
retrieval-augmented generation) is the B.Tech. major project of Mohammad Sameer, Rajeev Kumar Gupta and
Mohit Dev Tomar (Sharda University). Dr. Dharm Raj supervises it and Prof. (Dr.) Parma Nand co-supervises it.
The research paper also lists Dr. Rani Astya as an author.

This file says which documents are current, which paper to publish, and where everything lives.

---

## Which paper to use

| File | What it is | Use it for |
| --- | --- | --- |
| **`paper/STP_RAG_Research_Paper_v2.tex`** (and `.pdf`) | Six-page IEEE conference version | **The paper to submit to a conference** |
| `paper/STP_RAG_Research_Paper_v2_full.tex` (and `.pdf`) | Eleven-page full version with every table and figure | arXiv preprint or a journal version |
| `paper_orchestra/output/final_paper_corrected.pdf` | Draft written by a language model | Reference only: **do not submit** |
| `archive/v1_paper/STP_RAG_Research_Paper_Revised.tex` | The September version | Superseded: **do not submit** |

Both current versions share one bibliography (`paper/references.bib`) and one data source
(`paper/data/pilot_summary_metrics.csv`), so their numbers cannot drift apart.

**When to submit.** The paper currently reports an *audited pilot* plus a *pre-registered confirmatory
protocol*; it makes no confirmatory claim. It can go to a venue that accepts methods, audit or protocol
papers now. For a standard results paper, run the confirmatory experiment first, following
`PROJECT_PLAN_20_WEEKS.md` (submission is planned for Week 18).

**Check against the guide's page budget.** `paper/guide_requirements/guide_page_budget_handwritten.jpeg` asks for 6–7 pages, with a
literature review of 1.5–2 pages *including a table* and an introduction with an image. The six-page
version removed the related-work table to fit six pages. Confirm the page limit with the guide and the venue.
If seven pages are allowed, restore Table 1 from the full version.

---

## Where everything is

| Folder or file | Contents | Status |
| --- | --- | --- |
| `PROJECT_PLAN_20_WEEKS.md` | Week-by-week plan from research to submission and final presentation | **Follow this** |
| `paper/` | The research paper: both versions, bibliography, pilot data, generated tables and plots, revision notes, the guide's requirements | **Current** |
| `report/Major_Project_Report_STP-RAG.docx` | University major-project report in the department format | **Current** |
| `stp_eval_harness/` | Evaluation harness: metrics, statistics, records, report command; 27 tests | **Current code** |
| `dashboard/` | Interactive dashboard (Playground, Try it, How STP works, Evidence); `dashboard/HOW_TO_USE.md` explains it | **Current code** |
| `audit/STP_RAG_COMPREHENSIVE_AUDIT_REPORT.md` | Audit of the pilot implementation, cited in the paper | Source document |
| `presentation/` | Evaluation 1 slides material, speaker notes and the rubric screenshot | Past evaluation |
| `paper_orchestra/` | Machine-drafting workflow, its inputs and outputs; see its README | Reference only |
| `archive/` | Superseded material, kept for history | Do not follow |
| `tools/` | Third-party Paper Orchestra code (not tracked by git) | Tooling |

**What is in `archive/`:**

- `v1_paper/`: the September paper, its results, the figure script, its notes, and the two peer reviews it received.
- `early_plans/`: the first implementation and web-app plans.
- `dr_rag_evaluation_0/`: the Evaluation-0 deck from when the project was called DR-RAG.

---

## Common tasks

```bash
# paper: rebuild tables and plots from the data, then compile both versions
cd paper
python3 scripts/make_results.py
latexmk -pdf STP_RAG_Research_Paper_v2.tex          # needs biber
latexmk -pdf STP_RAG_Research_Paper_v2_full.tex

# evaluation harness tests
cd stp_eval_harness && python3 -m unittest discover -s tests

# dashboard
cd dashboard && npm install && npm run dev            # http://localhost:5173
npm test                                              # 38 tests
```

In Overleaf, upload `paper/STP_RAG_Research_Paper_v2.tex`, `paper/references.bib` and the
`paper/results/` folder, and set the compiler to pdfLaTeX with Biber.

---

## Rules that keep the work honest

- Every number in the paper comes from `paper/data/pilot_summary_metrics.csv` through `paper/scripts/make_results.py`; never type results by hand.
- Pilot results are descriptive. Say so wherever they appear.
- Cite only sources you have checked; `paper/REVISION_NOTES.md` records how each citation was verified.
- Keys (OpenRouter, Semantic Scholar) live only in `tools/paper-orchestra/.env`, which git ignores.
- `report/` holds student registration numbers. Keep the GitHub repository private, or remove that file before making it public.
