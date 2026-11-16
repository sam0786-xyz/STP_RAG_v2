from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
import numpy as np
import pandas as pd


RESULTS = Path("results")
PLOTS = RESULTS / "plots"
METHODS = [
    "Fixed-size",
    "Similarity-threshold",
    "Velocity-only",
    "Velocity + acceleration",
    "Full STP",
    "Full STP + selective context",
]
LABELS = ["Fixed", "Similarity", "Velocity", "Vel.+acc.", "STP", "STP+ctx"]
COLORS = ["#333333", "#999999", "#0072B2", "#E69F00", "#009E73", "#CC79A7"]
MARKERS = ["s", "v", "o", "^", "D", "P"]


def save_figure(figure, name):
    for extension in ("pdf", "png"):
        figure.savefig(PLOTS / f"{name}.{extension}", dpi=300, bbox_inches="tight")
    plt.close(figure)


def style_axis(axis):
    axis.spines[["top", "right"]].set_visible(False)
    axis.grid(alpha=0.18, linewidth=0.6)
    axis.set_axisbelow(True)


def add_method_legend(figure):
    handles = [
        Line2D([], [], color=color, marker=marker, linestyle="none", label=label)
        for color, marker, label in zip(COLORS, MARKERS, LABELS)
    ]
    figure.legend(handles=handles, loc="lower center", ncol=6, frameon=False)


def write_tables(data):
    metrics = ["recall", "mrr", "em", "f1", "chunks", "build", "latency"]
    for dataset, filename in [("HotpotQA", "table_hotpotqa.tex"), ("QASPER", "table_qasper.tex")]:
        subset = data[data.dataset == dataset].set_index("method").loc[METHODS]
        lines = [
            r"\begin{tabular*}{\textwidth}{@{\extracolsep{\fill}}lccccccc@{}}",
            r"\toprule",
            r"Method & Recall@5 & MRR & EM & F1 & Chunks/doc. & Build (s) & Retrieval (ms) \\",
            r"\midrule",
        ]
        for method, values in subset.iterrows():
            cells = ["STP + selective context" if method == METHODS[-1] else method]
            for metric in metrics:
                mean = values[f"{metric}_mean"]
                deviation = values[f"{metric}_sd"]
                content = f"{mean:.3f}\\pm{deviation:.3f}"
                if metric in metrics[:4] and mean == subset[f"{metric}_mean"].max():
                    content = r"\mathbf{" + content + "}"
                cells.append("$" + content + "$")
            lines.append(" & ".join(cells) + r" \\")
        lines.extend([r"\bottomrule", r"\end{tabular*}"])
        (RESULTS / filename).write_text("\n".join(lines) + "\n")


def plot_deltas(data):
    figure, axes = plt.subplots(1, 2, figsize=(7.1, 2.75), sharex=True, sharey=True)
    selected = [0, 1, 3, 4, 5]
    positions = np.arange(len(selected))
    for axis, dataset in zip(axes, ["HotpotQA", "QASPER"]):
        subset = data[data.dataset == dataset].set_index("method").loc[METHODS]
        for metric, offset, color, marker, label in [
            ("recall", -0.15, "#0072B2", "o", "Recall@5"),
            ("f1", 0.15, "#D55E00", "s", "Answer F1"),
        ]:
            differences = subset[f"{metric}_mean"].iloc[selected] - subset.loc["Velocity-only", f"{metric}_mean"]
            axis.hlines(positions + offset, 0, differences, color=color, linewidth=1.8)
            axis.scatter(differences, positions + offset, color=color, marker=marker, s=22, label=label, zorder=3)
        axis.axvline(0, color="#555555", linewidth=0.8)
        axis.set_title(dataset, fontweight="bold")
        axis.set_xlabel("Difference from velocity-only (score units)")
        axis.set_yticks(positions, [LABELS[index] for index in selected])
        axis.set_xlim(-0.085, 0.145)
        style_axis(axis)
    axes[0].invert_yaxis()
    handles, labels = axes[0].get_legend_handles_labels()
    figure.legend(handles, labels, loc="lower center", ncol=2, frameon=False)
    figure.tight_layout(rect=(0, 0.10, 1, 1))
    save_figure(figure, "delta_vs_baseline")


def plot_tradeoffs(data, structure=False):
    figure, axes = plt.subplots(1, 2, figsize=(7.1, 2.6))
    for axis, dataset in zip(axes, ["HotpotQA", "QASPER"]):
        subset = data[data.dataset == dataset].set_index("method").loc[METHODS]
        for method, color, marker in zip(METHODS, COLORS, MARKERS):
            values = subset.loc[method]
            horizontal = "chunks" if structure else "latency"
            vertical = "f1" if structure else "recall"
            axis.errorbar(
                values[f"{horizontal}_mean"], values[f"{vertical}_mean"],
                xerr=values[f"{horizontal}_sd"], yerr=values[f"{vertical}_sd"],
                marker=marker, color=color, markersize=6, capsize=2,
                elinewidth=0.8, linestyle="none", zorder=3,
            )
        if not structure:
            frontier = []
            for method, values in subset.iterrows():
                dominated = (
                    (subset.latency_mean <= values.latency_mean)
                    & (subset.recall_mean >= values.recall_mean)
                    & ((subset.latency_mean < values.latency_mean) | (subset.recall_mean > values.recall_mean))
                ).any()
                if not dominated:
                    frontier.append((values.latency_mean, values.recall_mean))
            frontier.sort()
            axis.plot(*zip(*frontier), linestyle="--", color="#444444", linewidth=0.9, zorder=2)
            axis.set_ylabel("Recall@5")
            axis.set_xlabel("Mean retrieval latency (ms)")
            axis.set_ylim((0.975, 1.006) if dataset == "HotpotQA" else (0.23, 0.40))
        else:
            axis.set_ylabel("Answer F1")
            axis.set_xlabel("Mean chunks per document")
            axis.set_ylim(0, 0.45)
        axis.set_title(dataset, fontweight="bold")
        style_axis(axis)
    add_method_legend(figure)
    figure.tight_layout(rect=(0, 0.12, 1, 1))
    save_figure(figure, "structure_breakdown" if structure else "pareto_latency_recall")


def main():
    data = pd.read_csv(RESULTS / "summary_metrics.csv")
    assert len(data) == 12 and not data.isna().any().any()
    assert not data.duplicated(["dataset", "method"]).any()
    for dataset in ["HotpotQA", "QASPER"]:
        assert set(data[data.dataset == dataset].method) == set(METHODS)
    for metric in ["recall", "mrr", "em", "f1"]:
        assert data[f"{metric}_mean"].between(0, 1).all()
    assert (data.filter(regex="_sd$") >= 0).all().all()
    PLOTS.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update({"font.size": 8, "font.family": "DejaVu Sans", "pdf.fonttype": 42})
    write_tables(data)
    plot_deltas(data)
    plot_tradeoffs(data)
    plot_tradeoffs(data, structure=True)
    print("Generated two tables and three PDF/PNG figures from 12 supplied aggregate rows.")


if __name__ == "__main__":
    main()