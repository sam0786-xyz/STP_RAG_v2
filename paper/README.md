# paper/: the research paper

| File | Purpose |
| --- | --- |
| `STP_RAG_Research_Paper_v2.tex` / `.pdf` | **Six-page IEEE conference version: the one to submit** |
| `STP_RAG_Research_Paper_v2_full.tex` / `.pdf` | Eleven-page full version (arXiv or journal); also the source of the dashboard's demo text |
| `references.bib` | Shared bibliography; every entry verified (see `REVISION_NOTES.md`) |
| `data/pilot_summary_metrics.csv` | The audited pilot aggregates: the single source of every number |
| `scripts/make_results.py` | Generates `results/` (tables, plots, `pilot_metrics.json`) from the CSV |
| `results/` | Generated tables and PGFPlots figures; do not edit by hand |
| `REVISION_NOTES.md` | What changed in each revision and why, including the six-page condensation |
| `guide_requirements/` | The guide's handwritten page budget for the paper |

Build:

```bash
python3 scripts/make_results.py
latexmk -pdf STP_RAG_Research_Paper_v2.tex
latexmk -pdf STP_RAG_Research_Paper_v2_full.tex
latexmk -c   # remove build files
```

The six-page version needs the IEEEtran class and Biber; both come with TeX Live.
