"""Build a run bundle for the dashboard from per-query JSONL records.

Layout expected under ``runs_dir``::

    runs_dir/<dataset>/<arm>.jsonl[.gz]

Usage::

    python -m stp_eval.report runs/ --baseline fixed_matched --out bundle.json \
        --cluster QASPER --metrics f1 em recall@5

Every comparison is paired: only queries present in both the arm and the
baseline are used, and the count is reported. Datasets named with --cluster
use the document bootstrap and cluster-level sign flips.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from . import __version__
from .records import read_records, sha256_file
from .stats import cluster_bootstrap, holm, paired_bootstrap, sign_flip_test


def _mean(xs: list[float]) -> float | None:
    return sum(xs) / len(xs) if xs else None


def build_bundle(runs_dir: Path, baseline: str, metrics: list[str], cluster_datasets: set[str],
                 resamples: int = 10_000, seed: int = 0) -> dict:
    datasets: dict = {}
    files: dict[str, str] = {}
    for ds_dir in sorted(p for p in runs_dir.iterdir() if p.is_dir()):
        arms: dict[str, dict[str, object]] = {}
        for f in sorted(ds_dir.glob("*.jsonl*")):
            files[str(f.relative_to(runs_dir))] = sha256_file(f)
            for r in read_records(f):
                arms.setdefault(r.arm, {})[r.query_id] = r
        if baseline not in arms:
            raise SystemExit(f"{ds_dir.name}: baseline arm '{baseline}' not found (arms: {sorted(arms)})")
        clustered = ds_dir.name in cluster_datasets
        base = arms[baseline]
        summary, comparisons = {}, {}
        for arm, recs in arms.items():
            summary[arm] = {
                "n": len(recs),
                "prompt_tokens": _mean([r.prompt_tokens for r in recs.values()]),  # type: ignore[attr-defined]
                **{m: _mean([r.metrics[m] for r in recs.values() if r.metrics.get(m) is not None])  # type: ignore[attr-defined]
                   for m in metrics},
            }
        for m in metrics:
            pvals: dict[str, float] = {}
            rows = {}
            for arm, recs in arms.items():
                if arm == baseline:
                    continue
                shared = [q for q in recs if q in base
                          and recs[q].metrics.get(m) is not None and base[q].metrics.get(m) is not None]  # type: ignore[attr-defined]
                if not shared:
                    continue
                diffs = [recs[q].metrics[m] - base[q].metrics[m] for q in shared]  # type: ignore[attr-defined]
                docs = [recs[q].doc_id for q in shared]  # type: ignore[attr-defined]
                if clustered:
                    ci = cluster_bootstrap(diffs, docs, resamples, seed=seed)
                    p = sign_flip_test(diffs, docs, resamples, seed=seed)
                else:
                    ci = paired_bootstrap(diffs, resamples, seed=seed)
                    p = sign_flip_test(diffs, None, resamples, seed=seed)
                pvals[arm] = p
                rows[arm] = {"delta": ci.mean, "ci_low": ci.low, "ci_high": ci.high, "p": p,
                             "n_pairs": len(shared), "n_units": ci.n_units, "method": ci.method}
            for arm, adj in holm(pvals).items():
                rows[arm]["p_holm"] = adj
            comparisons[m] = rows
        queries = {}
        for arm, recs in arms.items():
            for q, r in recs.items():
                entry = queries.setdefault(q, {"query_id": q, "doc_id": r.doc_id, "question": r.question,  # type: ignore[attr-defined]
                                               "gold_answers": r.gold_answers, "type": r.question_type,  # type: ignore[attr-defined]
                                               "arms": {}})
                entry["arms"][arm] = {"prediction": r.prediction, "prompt_tokens": r.prompt_tokens,  # type: ignore[attr-defined]
                                      "metrics": r.metrics,  # type: ignore[attr-defined]
                                      "retrieved": [{"id": c.chunk_id, "score": c.score, "tokens": c.tokens,
                                                     "context_tokens": c.context_tokens}
                                                    for c in r.retrieved]}  # type: ignore[attr-defined]
        datasets[ds_dir.name] = {"clustered": clustered, "baseline": baseline, "arms": summary,
                                 "comparisons": comparisons, "queries": list(queries.values())}
    return {"kind": "stp-eval-run", "harness_version": __version__,
            "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "resamples": resamples, "seed": seed, "metrics": metrics, "files": files, "datasets": datasets}


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("runs_dir", type=Path)
    ap.add_argument("--baseline", required=True)
    ap.add_argument("--metrics", nargs="+", default=["recall@5", "mrr@10", "em", "f1"])
    ap.add_argument("--cluster", nargs="*", default=["QASPER"], help="datasets that use the document bootstrap")
    ap.add_argument("--resamples", type=int, default=10_000)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args(argv)
    bundle = build_bundle(a.runs_dir, a.baseline, a.metrics, set(a.cluster), a.resamples, a.seed)
    a.out.write_text(json.dumps(bundle, indent=1) + "\n")
    print(f"wrote {a.out} ({len(bundle['datasets'])} datasets)")


if __name__ == "__main__":
    main()
