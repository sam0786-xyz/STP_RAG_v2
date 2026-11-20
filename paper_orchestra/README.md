# Paper Orchestra (machine-drafted working paper)

**Status: reference only. Do not submit this draft.** The paper to publish is
`../paper/STP_RAG_Research_Paper_v2.tex` (see the root `README.md`).

This folder runs google-research/paper-orchestra (vendored in `../tools/paper-orchestra`,
upstream commit `d9bae99`) through OpenRouter to draft a paper from the inputs below.
The draft was useful as a cross-check, but it was written by a language model, it invented
some protocol details (cluster thresholds) that are not in our protocol, and it would need a
full rewrite and an AI-writing and plagiarism check before any use.

## Layout

| Path | Contents |
| --- | --- |
| `inputs/raw_materials/` | Method brief (`idea_sparse.md`), audited evidence ledger (`experimental_log.md`), three pilot figures |
| `inputs/stp_rag_template/` | LaTeX template and writing guidelines given to the pipeline |
| `output/final_paper_corrected.pdf` | The verified draft: numbers checked, authors and figures restored, latency passage corrected |
| `output/final_paper.pdf` | The pipeline's own output, unchanged |
| `logs/` | Run logs (run 1 without a Semantic Scholar key, run 2 with one) |
| `openrouter_adapter.patch` | Our changes to the vendored tool: OpenRouter routing, Semantic Scholar key and retries |
| `run_paper_orchestra_stp_rag.sh` | Runner |

## Run it again

```bash
# one-time setup of the vendored tool
cd tools/paper-orchestra
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
git apply ../../paper_orchestra/openrouter_adapter.patch   # only on a fresh clone
# keys go in tools/paper-orchestra/.env (never committed):
#   OPENROUTER_API_KEY=sk-or-v1-...
#   SEMANTIC_SCHOLAR_API_KEY=...   (S2_API_Key also accepted)
cd ../..
./paper_orchestra/run_paper_orchestra_stp_rag.sh > paper_orchestra/logs/run.log 2>&1
```

The default model is `openai/gpt-6.1-terra`; set `OPENROUTER_MODEL` to change it. A run takes
about two hours and uses OpenRouter credit. Check every number and citation in the output
against `../paper/data/pilot_summary_metrics.csv` before using any of it.
