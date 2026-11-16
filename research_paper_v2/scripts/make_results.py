"""Generate every result table and PGFPlots figure in the v2 manuscript.

Single source of truth: data/pilot_summary_metrics.csv (the audited pilot
aggregates, unchanged). Run from the research_paper_v2 directory:

    python3 scripts/make_results.py

Standard library only. The script also writes results/pilot_metrics.json,
which the dashboard reads, so the paper and the dashboard cannot drift apart.

Labelling rules applied here (reviewer items 7-9):
  * the legacy ``velocity_only`` arm keeps its structural weight w_s, so it is
    labelled "Velocity + structure" everywhere;
  * the legacy ``velocity_acceleration`` arm is labelled with a dagger because
    its w_s status and acceleration sign were not verified;
  * EM is shown with the absolute count out of the 25 generated answers;
  * a standard deviation is printed only when it is non-zero, because the
    retrieval metrics are identical across the three deterministic seeds.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "pilot_summary_metrics.csv"
OUT = ROOT / "results"

GEN_QUERIES = 25  # max_eval_queries in the pilot configuration

# legacy name in CSV -> (table label, short plot label, key, style)
ARMS = {
    "Fixed-size": ("Fixed-size", "Fixed", "fixed", "stpfixed"),
    "Similarity-threshold": ("Similarity threshold", "Similarity", "similarity", "stpsimilarity"),
    "Velocity-only": (r"Velocity + structure$^{\dagger}$", "Vel.+struct.", "vel_struct", "stpvelocity"),
    "Velocity + acceleration": (r"Velocity + acceleration$^{\ddagger}$", "Vel.+acc.", "vel_acc", "stpacceleration"),
    "Full STP": ("Full STP", "STP", "full_stp", "stpfull"),
    "Full STP + selective context": ("Full STP + context", "STP+ctx", "full_stp_ctx", "stpcontext"),
}

QUALITY = ["recall", "mrr", "em", "f1"]


def load() -> dict[str, list[dict]]:
    by_ds: dict[str, list[dict]] = {}
    with CSV_PATH.open(newline="") as fh:
        for row in csv.DictReader(fh):
            rec = {"dataset": row["dataset"], "method": row["method"]}
            for k, v in row.items():
                if k not in ("dataset", "method"):
                    rec[k] = float(v)
            by_ds.setdefault(row["dataset"], []).append(rec)
    return by_ds


def fmt(mean: float, sd: float, bold: bool = False, always_sd: bool = False) -> str:
    body = f"{mean:.3f}"
    if sd > 0 or always_sd:
        body += rf"{{\scriptsize$\pm${sd:.3f}}}"
    return rf"\textbf{{{body}}}" if bold else body


HEADER = r"Arm & Recall@5 & MRR & EM ($k$/25) & F1 & Chunks/doc. & Build (s) & Retrieval (ms) \\"


def rows_tex(rows: list[dict]) -> list[str]:
    best = {m: max(r[f"{m}_mean"] for r in rows) for m in QUALITY}
    lines = []
    for r in rows:
        label = ARMS[r["method"]][0]
        cells = [label]
        cells.append(fmt(r["recall_mean"], r["recall_sd"], r["recall_mean"] == best["recall"]))
        cells.append(fmt(r["mrr_mean"], r["mrr_sd"], r["mrr_mean"] == best["mrr"]))
        k = round(r["em_mean"] * GEN_QUERIES)
        em = f"{r['em_mean']:.3f} ({k})"
        cells.append(rf"\textbf{{{em}}}" if r["em_mean"] == best["em"] else em)
        cells.append(fmt(r["f1_mean"], r["f1_sd"], r["f1_mean"] == best["f1"]))
        cells.append(f"{r['chunks_mean']:.2f}")
        cells.append(fmt(r["build_mean"], r["build_sd"], always_sd=True))
        cells.append(fmt(r["latency_mean"], r["latency_sd"], always_sd=True))
        lines.append(" & ".join(cells) + r" \\")
    return lines


def table(rows: list[dict]) -> str:
    lines = [r"\begin{tabular*}{\textwidth}{@{\extracolsep{\fill}}lccccccc@{}}", r"\toprule", HEADER, r"\midrule"]
    lines += rows_tex(rows) + [r"\bottomrule", r"\end{tabular*}"]
    return "\n".join(lines) + "\n"


def table_combined(data: dict[str, list[dict]]) -> str:
    """Both datasets in one full-width table, for the two-column conference version."""
    lines = [r"\begin{tabular*}{\textwidth}{@{\extracolsep{\fill}}lccccccc@{}}", r"\toprule", HEADER, r"\midrule",
             r"\multicolumn{8}{@{}l}{\textit{HotpotQA: 150 retrieval queries, 25 generated answers}} \\"]
    lines += rows_tex(data["HotpotQA"])
    lines += [r"\midrule",
              r"\multicolumn{8}{@{}l}{\textit{QASPER: 107 aligned retrieval queries (42 of 149 dropped), 25 generated answers}} \\"]
    lines += rows_tex(data["QASPER"]) + [r"\bottomrule", r"\end{tabular*}"]
    return "\n".join(lines) + "\n"


def delta_plot(data: dict[str, list[dict]]) -> str:
    """Rounded-mean differences from the velocity + structure arm."""
    order = ["Fixed-size", "Similarity-threshold", "Velocity + acceleration", "Full STP",
             "Full STP + selective context"]
    labels = ",".join(ARMS[m][1] for m in order)

    def coords(rows: list[dict], metric: str, offset: float) -> str:
        ref = next(r for r in rows if r["method"] == "Velocity-only")[f"{metric}_mean"]
        pts = []
        for i, m in enumerate(order):
            row = next(r for r in rows if r["method"] == m)
            pts.append(f"({row[f'{metric}_mean'] - ref:.3f},{i + offset:.2f})")
        return " ".join(pts)

    hp, qa = data["HotpotQA"], data["QASPER"]
    return rf"""\begin{{tikzpicture}}
\begin{{groupplot}}[stpaxis,group style={{group size=2 by 1,horizontal sep=14mm}},xmin=-0.095,xmax=0.145,ymin=-0.5,ymax=4.5,y dir=reverse,ytick={{0,1,2,3,4}},xtick={{-0.05,0,0.05,0.10}},xlabel={{Difference from velocity + structure arm}}]
\nextgroupplot[title={{HotpotQA}},yticklabels={{{labels}}},legend to name=stp-delta-legend,legend columns=2]
\addplot[black!65,no marks,forget plot] coordinates {{(0,-0.5) (0,4.5)}};
\addplot[xcomb,semithick,mark size=1.8pt,stpvelocity] coordinates {{{coords(hp, 'recall', -0.14)}}};
\addlegendentry{{Recall@5 (150 queries)}}
\addplot[xcomb,semithick,mark size=1.8pt,color=stpanswer,mark=square*] coordinates {{{coords(hp, 'f1', 0.14)}}};
\addlegendentry{{Answer F1 (25 queries)}}
\nextgroupplot[title={{QASPER}},yticklabels=\empty]
\addplot[black!65,no marks,forget plot] coordinates {{(0,-0.5) (0,4.5)}};
\addplot[xcomb,semithick,mark size=1.8pt,stpvelocity] coordinates {{{coords(qa, 'recall', -0.14)}}};
\addplot[xcomb,semithick,mark size=1.8pt,color=stpanswer,mark=square*] coordinates {{{coords(qa, 'f1', 0.14)}}};
\end{{groupplot}}
\end{{tikzpicture}}
\par\smallskip
\pgfplotslegendfromname{{stp-delta-legend}}
"""


def latency_plot(data: dict[str, list[dict]]) -> str:
    def panel(rows: list[dict], legend: bool) -> str:
        out = []
        for r in rows:
            _, short, _, style = ARMS[r["method"]]
            out.append(
                rf"\addplot[only marks,mark size=2.1pt,{style},error bars/.cd,x dir=both,x explicit] "
                rf"coordinates {{({r['latency_mean']:.3f},{r['recall_mean']:.3f}) +- ({r['latency_sd']:.3f},0)}};"
            )
            if legend:
                out.append(rf"\addlegendentry{{{short}}}")
        return "\n".join(out)

    return rf"""\begin{{tikzpicture}}
\begin{{groupplot}}[stpaxis,group style={{group size=2 by 1,horizontal sep=16mm}}]
\nextgroupplot[title={{HotpotQA}},xlabel={{Mean retrieval latency (ms)}},ylabel={{Recall@5}},ymin=0.975,ymax=1.006,legend to name=stp-latency-legend,legend columns=6]
{panel(data['HotpotQA'], True)}
\nextgroupplot[title={{QASPER (107 aligned queries)}},xlabel={{Mean retrieval latency (ms)}},ylabel={{Recall@5}},ymin=0.23,ymax=0.40]
{panel(data['QASPER'], False)}
\end{{groupplot}}
\end{{tikzpicture}}
\par\smallskip
\pgfplotslegendfromname{{stp-latency-legend}}
"""


def export_json(data: dict[str, list[dict]]) -> None:
    payload = {
        "source": "data/pilot_summary_metrics.csv (audited pilot aggregates, unchanged)",
        "generation_queries": GEN_QUERIES,
        "retrieval_queries": {"HotpotQA": 150, "QASPER": 107},
        "qasper_dropped": {"dropped": 42, "total": 149},
        "arms": {k: {"label": v[0].replace(r"$^{\dagger}$", "").replace(r"$^{\ddagger}$", ""),
                     "short": v[1], "key": v[2], "legacy_name": k} for k, v in ARMS.items()},
        "rows": [
            {**r, "arm": ARMS[r["method"]][2], "em_count": round(r["em_mean"] * GEN_QUERIES)}
            for rows in data.values() for r in rows
        ],
    }
    (OUT / "pilot_metrics.json").write_text(json.dumps(payload, indent=2) + "\n")


def main() -> None:
    OUT.mkdir(exist_ok=True)
    data = load()
    (OUT / "table_hotpotqa.tex").write_text(table(data["HotpotQA"]))
    (OUT / "table_qasper.tex").write_text(table(data["QASPER"]))
    (OUT / "table_pilot.tex").write_text(table_combined(data))
    (OUT / "plot_delta.tex").write_text(delta_plot(data))
    (OUT / "plot_latency.tex").write_text(latency_plot(data))
    export_json(data)
    print("wrote", sorted(p.name for p in OUT.iterdir()))


if __name__ == "__main__":
    main()
