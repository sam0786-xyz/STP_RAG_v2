"""Build the dashboard's demo data from a real document with a real encoder.

The document is Sections 1-3 of the v2 manuscript (the paper describes STP-RAG,
so its own text is a convenient, structured, citable sample). Signals,
chunkings and retrieval below are computed, not drawn. What is NOT real:
the boundary weights are hand-set demo values (no calibration data exists),
the scalers are fitted on this one document, and the questions and their gold
sentences were written for illustration.

Run with an environment that has fastembed installed:

    python scripts/build_demo.py

Writes public/data/demo.json and copies the pilot metrics to public/data/pilot.json.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "stp_eval_harness"))

from stp_eval import budget, context, metrics, profile, segment  # noqa: E402

TEX = ROOT / "paper" / "STP_RAG_Research_Paper_v2_full.tex"  # full version: the six-page file is condensed
PILOT = ROOT / "paper" / "results" / "pilot_metrics.json"
OUT = HERE.parent / "public" / "data"
MODEL = "BAAI/bge-small-en-v1.5"

# Demo parameters, scaled to sentence units of ~20-40 tokens.
WEIGHTS = profile.BoundaryWeights(w_v=1.1, w_a=0.5, w_sigma=0.3, w_s=(3.0, 0.9, 0.4, 0.0, 0.0), beta=-1.6)
PARAMS = segment.SegmentParams(tau_b=0.5, L_min=40, L_t=110, L_max=200, gamma=0.5, eta=0.0)
FIXED_L = 200
SIM_PERCENTILE = 0.85
CTX = context.ContextParams(H_max=4, B_ctx=80, tau_r=0.55)
TOP_K = 3
PROMPT_BUDGET = 300

QUESTIONS = [
    ("What does semantic velocity measure?", ["Semantic velocity is the cosine displacement"]),
    ("Why is positive acceleration clamped at zero?", ["Clamping at zero matters"]),
    ("What happens when a chunk would exceed the maximum length?", ["When adding $u_i$ would make the chunk exceed"]),
    ("How does the transition barrier reuse the profile?", ["is a \\emph{transition barrier}", "The barrier is the second place"]),
    ("Which benchmark asks questions about full scientific papers?", ["and QASPER, information-seeking questions"]),
    ("What did Dense X Retrieval show about retrieval units?", ["Dense X Retrieval made this trade-off concrete"]),
]

ABBREV = re.compile(r"\b(e\.g|i\.e|et al|Eq|Eqs|Fig|Sec|vs|cf|RQ\d|H\d)\.$")


def clean_inline(s: str) -> str:
    """Readable text from LaTeX prose: drop citations, unwrap commands, simplify math."""
    s = re.sub(r"~?\\cite\{[^}]*\}", "", s)
    s = re.sub(r"\\(?:ref|eqref)\{([^}]*)\}", lambda m: {"eq:velocity": "1", "eq:acceleration": "2",
               "eq:volatility": "3", "eq:normalise": "4", "eq:profile": "5", "eq:boundary": "6",
               "eq:forced": "7", "eq:horizon": "8", "eq:contextscore": "9", "alg:segment": "1",
               "fig:architecture": "1", "tab:params": "2", "tab:related": "1", "sec:intro": "1",
               "sec:related": "2", "sec:method": "3", "sec:audit": "4", "sec:protocol": "5",
               "sec:results": "6", "sec:limitations": "7"}.get(m.group(1), "?"), s)
    s = s.replace("\\ldots", "…").replace("\\dots", "…")
    s = re.sub(r"\\(?:emph|textbf|texttt|operatorname)\{([^}]*)\}", r"\1", s)
    s = s.replace("\\,", " ").replace("\\ ", " ").replace("~", " ").replace("--", "–").replace("``", "“").replace("''", "”")

    # whole-name lookup, so \le never matches inside \left or \lceil
    symbols = {"pi": "π", "sigma": "σ", "lambda": "λ", "tau": "τ", "epsilon": "ε", "Delta": "Δ", "gamma": "γ",
               "eta": "η", "beta": "β", "ge": "≥", "le": "≤", "in": "∈", "pm": "±", "cup": "∪", "lceil": "⌈",
               "rceil": "⌉", "ldots": "…", "dots": "…", "mathbb": "", "left": "", "right": ""}
    words = {"min", "max", "exp", "cos", "log", "tok", "clip", "dist", "median", "IQR", "MAD", "sd", "scale"}
    LB, RB = "\x01", "\x02"  # literal set braces survive the brace stripping below

    def math(m: re.Match) -> str:
        t = m.group(1).replace("\\{", LB).replace("\\}", RB).replace("^{\\mathsf T}", "ᵀ").replace("\\mathsf{T}", "ᵀ")
        # keep a brace boundary so "\le\mathrm{end}" does not fuse into one unknown command
        t = re.sub(r"\\(hat|widehat|bar|tilde|mathbf|mathcal|mathrm|operatorname|tok|ctx)\{([^}]*)\}", r"{\2}", t)
        t = re.sub(r"\\[!,;]", "", t)
        t = re.sub(r"\\([a-zA-Z]+)", lambda c: symbols.get(c.group(1), c.group(1) if c.group(1) in words else ""), t)
        return t.replace("{", "").replace("}", "")

    s = re.sub(r"\$([^$]+)\$", math, s)
    s = re.sub(r"\\[a-zA-Z]+\*?", "", s)
    s = re.sub(r"\s+", " ", s.replace("{", "").replace("}", "")).strip()
    s = s.replace(LB, "{").replace(RB, "}")
    return re.sub(r"\s+([.,;:)])", r"\1", s)  # citations left a space before punctuation


def sentences(par: str) -> list[str]:
    out, buf = [], ""
    for piece in re.split(r"(?<=[.?!])\s+(?=[A-Z“(])", par):
        buf = f"{buf} {piece}".strip() if buf else piece
        if not ABBREV.search(buf):
            out.append(buf)
            buf = ""
    if buf:
        out.append(buf)
    return out


def extract_units(tex: str) -> list[dict]:
    body = tex.split("\\section{Introduction}")[1].split("\\section{Audit of the Pilot Implementation}")[0]
    body = "\\section{Introduction}" + body
    for env in ["table", "figure", "algorithm", "equation"]:
        body = re.sub(rf"\\begin\{{{env}\}}.*?\\end\{{{env}\}}", "\n\n", body, flags=re.S)
    body = re.sub(r"(?<!\\)%.*", "", body)
    # list items become their own blocks, tagged so they get the list-item structure flag
    body = re.sub(r"\\(begin|end)\{(itemize|enumerate)\}(\[[^\]]*\])?", "\n\n", body)
    body = re.sub(r"\\item\s*", "\n\n@@ITEM@@", body)
    units: list[dict] = []
    section = subsection = ""
    new_heading = False  # carried across blocks: a heading usually sits in its own block
    for block in re.split(r"\n\s*\n", body):
        block = block.strip()
        if not block:
            continue
        for m in re.finditer(r"\\(section|subsection)\{([^}]*)\}", block):
            if m.group(1) == "section":
                section, subsection = m.group(2), ""
            else:
                subsection = m.group(2)
            new_heading = True
        is_item = block.startswith("@@ITEM@@")
        block = block.replace("@@ITEM@@", "")
        block = re.sub(r"\\(section|subsection)\{[^}]*\}|\\label\{[^}]*\}|\\FloatBarrier|\\noindent", "", block)
        block = re.sub(r"\\paragraph\{([^}]*?)\.?\}", r"\1:", block)
        text = clean_inline(block)
        if len(text) < 25:
            continue
        for k, sent in enumerate(sentences(text)):
            units.append({"text": sent, "section": section, "subsection": subsection,
                          "heading": new_heading and k == 0, "para": k == 0, "item": is_item and k == 0})
            new_heading = False
    return units


def main() -> None:
    from fastembed import TextEmbedding

    tex = TEX.read_text()
    units = extract_units(tex)
    enc = TextEmbedding(MODEL)
    from tokenizers import Tokenizer

    tokenizer = Tokenizer.from_str(enc.model.tokenizer.to_str())  # private copy for counting
    tokenizer.no_truncation()
    tokenizer.no_padding()

    def ntok(t: str) -> int:
        return len(tokenizer.encode(t, add_special_tokens=False).ids)

    texts = [u["text"] for u in units]
    emb = [profile.l2_normalise(list(map(float, e))) for e in enc.embed(texts)]
    toks = [ntok(t) for t in texts]
    offset = 0
    for u, t in zip(units, toks):
        u["tokens"] = t
        u["start"], u["end"] = offset, offset + len(u["text"])
        offset = u["end"] + 1
    structure = [[int(u["heading"]), int(u["para"] and not u["heading"] and not u["item"]), int(u["item"]), 0, 0]
                 for u in units]

    prof = profile.compute_profile(emb, structure, w=5)
    scalers = profile.Scalers.fit([prof])
    scalers.apply(prof)
    pi = profile.boundary_probabilities(prof, WEIGHTS)

    stp_chunks = segment.segment(toks, pi, PARAMS)
    fixed_chunks = segment.fixed_size(toks, FIXED_L)
    vs = sorted(x for x in prof.v if x is not None)
    tau_sim = vs[int(SIM_PERCENTILE * (len(vs) - 1))]
    sim_chunks = segment.similarity_threshold(prof.v, toks, tau_sim, FIXED_L)
    sections = [f"{u['section']}/{u['subsection']}" for u in units]
    methods = {"fixed": fixed_chunks, "similarity": sim_chunks, "stp": stp_chunks}

    # context for STP chunks (profile-guided) and for fixed chunks (relevance-only control)
    ctx = {
        "stp": [context.select_context(c, emb, texts, toks, sections, pi, CTX) for c in stp_chunks],
        "fixed": [context.select_context(c, emb, texts, toks, sections, pi,
                                         context.ContextParams(**{**CTX.__dict__, "profile_guided": False}))
                  for c in fixed_chunks],
    }

    def chunk_text(c: segment.Chunk) -> str:
        return " ".join(texts[c.start:c.end + 1])

    chunk_emb = {m: [profile.l2_normalise(list(map(float, e))) for e in enc.embed([chunk_text(c) for c in cs])]
                 for m, cs in methods.items()}
    q_emb = [profile.l2_normalise(list(map(float, e)))
             for e in enc.query_embed([q for q, _ in QUESTIONS])]

    questions = []
    for (q, needles), qe in zip(QUESTIONS, q_emb):
        gold_units = []
        for needle in needles:
            hits = [i for i, u in enumerate(units) if clean_inline(needle) in u["text"]]
            if len(hits) != 1:
                raise SystemExit(f"gold needle {needle!r} matched {len(hits)} units")
            gold_units.append(hits[0])
        gold_spans = [(units[i]["start"], units[i]["end"]) for i in gold_units]
        per_method = {}
        for m, cs in methods.items():
            scores = [sum(a * b for a, b in zip(qe, ce)) for ce in chunk_emb[m]]
            order = sorted(range(len(cs)), key=lambda k: -scores[k])
            spans = [(units[cs[k].start]["start"], units[cs[k].end]["end"]) for k in order]
            ranked = [budget.RankedChunk(str(k), toks[cs[k].start:cs[k].end + 1]) for k in order]
            packed = budget.pack(ranked, PROMPT_BUDGET)
            packed_spans = []
            for p in packed:  # truncated chunks keep only their leading units
                c = cs[int(p.chunk_id)]
                kept, end = 0, c.start - 1
                for i in range(c.start, c.end + 1):
                    if kept + toks[i] > p.tokens_used:
                        break
                    kept += toks[i]
                    end = i
                packed_spans.append((units[c.start]["start"], units[end]["end"]))
            per_method[m] = {
                "ranking": [{"chunk": k, "score": round(scores[k], 4)} for k in order[:8]],
                "topk_tokens": sum(cs[k].tokens for k in order[:TOP_K]),
                "topk_recall": metrics.recall_at_k(spans, gold_spans, TOP_K),
                "mrr": metrics.mrr_at_k(spans, gold_spans, 10),
                "budget_chunks": [int(p.chunk_id) for p in packed],
                "budget_tokens": budget.prompt_tokens(packed),
                "budget_recall": sum(any(metrics.credits(s, g) for s in packed_spans) for g in gold_spans) / len(gold_spans),
                "split_rate": metrics.evidence_split_rate(
                    [(units[c.start]["start"], units[c.end]["end"]) for c in cs], gold_spans),
            }
        questions.append({"question": q, "gold_units": gold_units, "methods": per_method})

    r4 = lambda xs: [None if x is None else round(x, 4) for x in xs]  # noqa: E731
    demo = {
        "kind": "stp-demo",
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "document": {"title": "STP-RAG manuscript v2, Sections 1–3",
                     "source": str(TEX.relative_to(ROOT)),
                     "sha256": hashlib.sha256(TEX.read_bytes()).hexdigest()},
        "encoder": {"name": MODEL, "runtime": "fastembed (ONNX)", "normalised": True},
        "notes": [
            "Signals, chunkings, context selection and retrieval are computed by stp_eval on this document.",
            "Boundary weights are hand-set demo values; no development split was available for calibration.",
            "Robust scalers are fitted on this document alone.",
            "Questions and their gold sentences were written for illustration; they are not benchmark items.",
        ],
        "units": [{k: u[k] for k in ("text", "section", "subsection", "heading", "para", "tokens", "start", "end")}
                  for u in units],
        "signals": {"v": r4(prof.v), "a": r4(prof.a), "sigma": r4(prof.sigma), "v_hat": r4(prof.v_hat),
                    "a_hat": r4(prof.a_hat), "sigma_hat": r4(prof.sigma_hat), "structure": structure,
                    "pi": r4(pi), "scaler_methods": scalers.methods()},
        "weights": {"w_v": WEIGHTS.w_v, "w_a": WEIGHTS.w_a, "w_sigma": WEIGHTS.w_sigma, "w_s": list(WEIGHTS.w_s),
                    "beta": WEIGHTS.beta},
        "params": PARAMS.__dict__,
        "fixed_L": FIXED_L,
        "similarity": {"percentile": SIM_PERCENTILE, "tau": round(tau_sim, 4)},
        "context_params": CTX.__dict__,
        "retrieval": {"top_k": TOP_K, "prompt_budget": PROMPT_BUDGET},
        "chunkings": {m: [[c.start, c.end, c.tokens] for c in cs] for m, cs in methods.items()},
        "context": ctx,
        "questions": questions,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "demo.json").write_text(json.dumps(demo, ensure_ascii=False, separators=(",", ":")))
    shutil.copy(PILOT, OUT / "pilot.json")
    print(f"{len(units)} units; chunks fixed={len(fixed_chunks)} similarity={len(sim_chunks)} stp={len(stp_chunks)}; "
          f"scalers={scalers.methods()}")
    for qd in questions:
        print(qd["question"][:50], {m: (d["topk_tokens"], d["topk_recall"], d["budget_tokens"], d["budget_recall"])
                                     for m, d in qd["methods"].items()})


if __name__ == "__main__":
    main()
