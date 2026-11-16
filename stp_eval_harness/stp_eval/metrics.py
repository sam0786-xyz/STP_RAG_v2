"""Retrieval, answer and mechanism metrics (manuscript Section 5.4).

Spans are half-open intervals ``(start, end)`` in any consistent unit:
characters for credit and evidence splitting, token offsets for context
precision when a tokenizer is available.
"""

from __future__ import annotations

import re
import string
from collections import Counter
from typing import Sequence

Span = tuple[int, int]


def overlap(a: Span, b: Span) -> int:
    return max(0, min(a[1], b[1]) - max(a[0], b[0]))


def credits(chunk: Span, gold: Span, theta: float = 0.5) -> bool:
    """A chunk credits a gold span when it contains at least ``theta`` of it."""
    length = gold[1] - gold[0]
    return length > 0 and overlap(chunk, gold) / length >= theta


def recall_at_k(ranked: Sequence[Span], gold: Sequence[Span], k: int, theta: float = 0.5) -> float:
    if not gold:
        raise ValueError("Recall is undefined without gold spans; exclude and count the query")
    top = ranked[:k]
    return sum(any(credits(c, g, theta) for c in top) for g in gold) / len(gold)


def mrr_at_k(ranked: Sequence[Span], gold: Sequence[Span], k: int = 10, theta: float = 0.5) -> float:
    for rank, c in enumerate(ranked[:k], start=1):
        if any(credits(c, g, theta) for g in gold):
            return 1.0 / rank
    return 0.0


def evidence_split_rate(chunks: Sequence[Span], gold: Sequence[Span]) -> float:
    """Fraction of gold spans whose characters fall in two or more base chunks."""
    if not gold:
        return 0.0
    split = sum(sum(1 for c in chunks if overlap(c, g) > 0) >= 2 for g in gold)
    return split / len(gold)


def _union_overlap(spans: Sequence[Span], gold: Sequence[Span]) -> int:
    """Length of (union of spans) intersected with (union of gold)."""
    total = 0
    for s in _merge(spans):
        for g in _merge(gold):
            total += overlap(s, g)
    return total


def _merge(spans: Sequence[Span]) -> list[Span]:
    out: list[list[int]] = []
    for a, b in sorted(spans):
        if out and a <= out[-1][1]:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return [(a, b) for a, b in out]


def context_precision(context: Sequence[Span], gold: Sequence[Span]) -> float | None:
    """Share of attached context that lies inside gold evidence (None if no context)."""
    length = sum(b - a for a, b in _merge(context))
    return None if length == 0 else _union_overlap(context, gold) / length


def context_recovery(base: Sequence[Span], context: Sequence[Span], gold: Sequence[Span],
                     theta: float = 0.5) -> float | None:
    """Of the gold spans the base chunks miss, the fraction the context recovers."""
    missed = [g for g in gold if not any(credits(c, g, theta) for c in base)]
    if not missed:
        return None
    return sum(any(credits(c, g, theta) for c in context) for g in missed) / len(missed)


# --- answers: SQuAD normalisation (Rajpurkar et al., 2016) ---------------------

_ARTICLES = re.compile(r"\b(a|an|the)\b")
_PUNCT = set(string.punctuation)


def normalise_answer(s: str) -> str:
    s = s.lower()
    s = "".join(ch for ch in s if ch not in _PUNCT)
    s = _ARTICLES.sub(" ", s)
    return " ".join(s.split())


def exact_match(prediction: str, golds: Sequence[str]) -> float:
    p = normalise_answer(prediction)
    return float(any(p == normalise_answer(g) for g in golds))


def token_f1(prediction: str, golds: Sequence[str]) -> float:
    def f1(pred: str, gold: str) -> float:
        pt, gt = normalise_answer(pred).split(), normalise_answer(gold).split()
        if not pt or not gt:
            return float(pt == gt)
        common = sum((Counter(pt) & Counter(gt)).values())
        if common == 0:
            return 0.0
        precision, recall = common / len(pt), common / len(gt)
        return 2 * precision * recall / (precision + recall)

    return max(f1(prediction, g) for g in golds) if golds else 0.0
