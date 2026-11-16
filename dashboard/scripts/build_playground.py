"""Build public/data/playground.json for the Playground and Try it pages.

Inputs
  scripts/playground_samples.json   original sample passages (sentences, hand-marked topics and answers)
  public/data/demo.json             the paper document (its velocities join the scaler reference corpus)

What is computed here, with the stp_eval reference code and BAAI/bge-small-en-v1.5 (fastembed):
  * cosine similarity between neighbouring sentences of each sample;
  * robust scalers for velocity, positive acceleration and volatility, fitted on a reference corpus
    (the four samples plus the paper's Sections 1-3), so short pasted texts are scaled against
    something larger than themselves;
  * a parity record (boundary probabilities and STP chunks for the first sample) that
    src/lib/chunkers.test.ts checks the browser code against.

Everything else (the six chunking techniques) runs in the browser from the similarities.

    python scripts/build_playground.py
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "stp_eval_harness"))

from stp_eval import profile, segment  # noqa: E402

SRC = HERE / "playground_samples.json"
DEMO = HERE.parent / "public" / "data" / "demo.json"
OUT = HERE.parent / "public" / "data" / "playground.json"
MODEL = "BAAI/bge-small-en-v1.5"
WINDOW = 3  # volatility window, in sentences; shorter than the paper demo's 5 because passages are short
# Same hand-set demo weights as the paper demo (scripts/build_demo.py); not tuned on these samples.
WEIGHTS = profile.BoundaryWeights(w_v=1.1, w_a=0.5, w_sigma=0.3, w_s=(3.0, 0.9, 0.4, 0.0, 0.0), beta=-1.6)
# STP defaults in words for the playground (L_t = 0.55 * L_max, L_min = 0.2 * L_max, as in the UI)
PARITY_PARAMS = segment.SegmentParams(tau_b=0.5, L_min=18, L_t=50, L_max=90, gamma=0.5, eta=0.0)


def find(sentences: list[str], needle: str) -> int:
    hits = [i for i, s in enumerate(sentences) if s.startswith(needle)]
    if len(hits) != 1:
        raise SystemExit(f"needle {needle!r} matched {len(hits)} sentences")
    return hits[0]


def profile_from_sims(sims: list[float | None], para: list[int]) -> profile.Profile:
    v = [None] + [1.0 - s for s in sims[1:]]  # type: ignore[operator]
    return profile.Profile(v=v, a=profile.positive_acceleration(v), sigma=profile.volatility(v, WINDOW),
                           structure=[[0, p, 0, 0, 0] for p in para])


def main() -> None:
    from fastembed import TextEmbedding

    enc = TextEmbedding(MODEL)
    src = json.loads(SRC.read_text())
    demo = json.loads(DEMO.read_text())

    samples, profiles = [], []
    for s in src["samples"]:
        sents = [t for p in s["paragraphs"] for t in p]
        para = [int(k == 0 and pi > 0) for pi, p in enumerate(s["paragraphs"]) for k in range(len(p))]
        emb = [profile.l2_normalise(list(map(float, e))) for e in enc.embed(sents)]
        sims = [None] + [sum(a * b for a, b in zip(emb[i - 1], emb[i])) for i in range(1, len(emb))]
        prof = profile_from_sims(sims, para)
        profiles.append(prof)
        samples.append({
            "id": s["id"], "title": s["title"], "kind": s["kind"], "blurb": s["blurb"],
            "paragraphs": s["paragraphs"],
            "sims": [None if x is None else round(x, 4) for x in sims],
            "topics": [{"label": t["label"], "start": find(sents, t["needle"])} for t in s["topics"]],
            "questions": [{"q": q["q"], "gold": [find(sents, q["needle"])]} for q in s["questions"]],
        })

    # the paper document joins the reference corpus (its sims come from the same encoder in build_demo.py)
    paper_v = demo["signals"]["v"]
    paper_sims = [None] + [1.0 - x for x in paper_v[1:]]
    profiles.append(profile_from_sims(paper_sims, [0] * len(paper_v)))
    scalers = profile.Scalers.fit(profiles)

    # parity record on the first sample, with the samples' own rounded sims (what the browser sees)
    first = samples[0]
    sents = [t for p in first["paragraphs"] for t in p]
    para = [int(k == 0 and pi > 0) for pi, p in enumerate(first["paragraphs"]) for k in range(len(p))]
    prof = scalers.apply(profile_from_sims(first["sims"], para))
    pi = profile.boundary_probabilities(prof, WEIGHTS)
    words = [len(t.split()) for t in sents]
    chunks = segment.segment(words, pi, PARITY_PARAMS)

    sc = lambda r: {"center": round(r.center, 6), "scale": round(r.scale, 6), "method": r.method}  # noqa: E731
    out = {
        "kind": "stp-playground",
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "encoder": {"name": MODEL, "runtime": "fastembed (ONNX)", "browser": "Xenova/bge-small-en-v1.5 (fp16)"},
        "window": WINDOW,
        "weights": {"w_v": WEIGHTS.w_v, "w_a": WEIGHTS.w_a, "w_sigma": WEIGHTS.w_sigma, "w_s": list(WEIGHTS.w_s),
                    "beta": WEIGHTS.beta},
        "scalers": {"v": sc(scalers.v), "a": sc(scalers.a), "sigma": sc(scalers.sigma)},
        "reference_corpus": f"{len(samples)} sample passages + the paper's Sections 1–3 "
                            f"({sum(p.n for p in profiles)} sentences)",
        "samples": samples,
        "parity": {"sample": first["id"], "params": PARITY_PARAMS.__dict__,
                   "pi": [None if x is None else round(x, 6) for x in pi],
                   "chunks": [[c.start, c.end, c.tokens] for c in chunks]},
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"scalers {scalers.methods()} v=({scalers.v.center:.3f},{scalers.v.scale:.3f})")
    for s, p in zip(samples, profiles):
        scalers.apply(p)
        pis = profile.boundary_probabilities(p, WEIGHTS)
        wc = [len(t.split()) for par in s["paragraphs"] for t in par]
        cs = segment.segment(wc, pis, PARITY_PARAMS)
        print(s["id"], "words", sum(wc), "topics", [t["start"] for t in s["topics"]],
              "stp starts", [c.start for c in cs],
              "pi", [None if x is None else round(x, 2) for x in pis])


if __name__ == "__main__":
    main()
