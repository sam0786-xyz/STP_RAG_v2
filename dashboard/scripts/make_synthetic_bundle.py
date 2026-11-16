"""Generate a clearly labelled SYNTHETIC run bundle for testing the Runs page.

The records are random. They go through the real harness path
(records.write_records -> report.build_bundle), so this is also an end-to-end
test of the bundle format. The bundle is flagged ``"synthetic": true`` and the
dashboard shows a banner whenever it is loaded. Never cite these numbers.
"""

from __future__ import annotations

import json
import random
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent / "stp_eval_harness"))

from stp_eval import records, report  # noqa: E402

ARMS = {"fixed_matched": 0.0, "similarity": -0.02, "vel_struct": 0.01, "full_stp": 0.015, "full_stp_ctx": 0.03}


def make(dataset: str, n_queries: int, n_docs: int, rng: random.Random) -> list[records.QueryRecord]:
    out = []
    for i in range(n_queries):
        doc = f"doc{i % n_docs:03d}"
        doc_effect = rng.gauss(0, 0.12)
        base_f1 = min(1, max(0, rng.betavariate(2, 3) + doc_effect))
        for arm, shift in ARMS.items():
            f1 = min(1.0, max(0.0, base_f1 + shift + rng.gauss(0, 0.15)))
            rec5 = float(rng.random() < 0.55 + shift * 3)
            out.append(records.QueryRecord(
                dataset=dataset, arm=arm, query_id=f"{dataset[:2].lower()}{i:04d}", doc_id=doc,
                question=f"Synthetic question {i + 1}", gold_answers=["synthetic answer"],
                gold_spans=[(0, 40)],
                retrieved=[records.RetrievedChunk(f"c{rng.randrange(999)}", round(rng.uniform(0.4, 0.9), 3),
                                                  rng.randrange(80, 300), (0, 300),
                                                  context_tokens=rng.randrange(0, 120) if arm.endswith("ctx") else 0)
                           for _ in range(3)],
                prompt="(synthetic)", prompt_tokens=1024 - rng.randrange(0, 80), raw_generation="synthetic",
                prediction="synthetic answer" if f1 > 0.8 else "synthetic guess",
                metrics={"recall@5": rec5, "mrr@10": rec5 / rng.choice([1, 1, 2, 3]), "em": float(f1 > 0.85), "f1": round(f1, 4)},
                budget=1024, question_type=rng.choice(["bridge", "comparison"]) if dataset == "HotpotQA" else "extractive"))
    return out


def main() -> None:
    rng = random.Random(20261116)
    with tempfile.TemporaryDirectory() as d:
        runs = Path(d)
        for ds, nq, nd in [("HotpotQA", 300, 60), ("QASPER", 160, 40)]:
            recs = make(ds, nq, nd, rng)
            for arm in ARMS:
                records.write_records(runs / ds / f"{arm}.jsonl", [r for r in recs if r.arm == arm])
        bundle = report.build_bundle(runs, "fixed_matched", ["recall@5", "mrr@10", "em", "f1"], {"QASPER"},
                                     resamples=2000, seed=0)
    bundle["synthetic"] = True
    out = HERE.parent / "public" / "data" / "synthetic_run.json"
    out.write_text(json.dumps(bundle, separators=(",", ":")))
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
