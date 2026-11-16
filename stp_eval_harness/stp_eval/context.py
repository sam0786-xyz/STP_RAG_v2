"""Profile-guided selective context (manuscript Eqs. 8-9).

``select_context`` returns the unit indices attached to one base chunk. Setting
``ContextParams.profile_guided=False`` gives the relevance-only control used
across every chunker: fixed horizons of H_max and no transition barrier.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Sequence

from .segment import Chunk

_REF = re.compile(r"\b(?:Table|Fig(?:ure)?\.?|Eq(?:uation)?\.?|Section|Sec\.)\s*\(?\d+\)?", re.I)
_NUM = re.compile(r"\b\d+(?:\.\d+)?\b")
_ENT = re.compile(r"\b[A-Z][a-zA-Z0-9-]+\b")


@dataclass
class ContextParams:
    H_max: int = 6
    B_ctx: int = 192
    tau_r: float = 0.30
    lam_e: float = 1.0
    lam_r: float = 0.5
    lam_a: float = 0.25
    lam_t: float = 1.0
    lam_d: float = 0.25
    profile_guided: bool = True


def references(text: str) -> set[str]:
    """Entities, numbers and cross-references used by the overlap term R."""
    refs = {m.group(0).lower().replace(" ", "") for m in _REF.finditer(text)}
    refs |= set(_NUM.findall(text))
    words = text.split()
    # skip a sentence-initial capital, which is usually not an entity
    refs |= {m.group(0) for m in _ENT.finditer(" ".join(words[1:]))}
    return refs


def jaccard(a: set[str], b: set[str]) -> float:
    return len(a & b) / len(a | b) if (a or b) else 0.0


def _mean_unit(emb: Sequence[Sequence[float]], start: int, end: int) -> list[float]:
    d = len(emb[start])
    acc = [0.0] * d
    for i in range(start, end + 1):
        for k in range(d):
            acc[k] += emb[i][k]
    norm = math.sqrt(sum(x * x for x in acc)) or 1.0
    return [x / norm for x in acc]


def horizons(chunk: Chunk, pi: Sequence[float | None], n: int, p: ContextParams) -> tuple[int, int]:
    """Eq. 8. A document edge acts as a certain boundary (probability 1)."""
    if not p.profile_guided:
        return p.H_max, p.H_max
    pi_open = pi[chunk.start] if chunk.start > 0 else 1.0
    pi_close = pi[chunk.end + 1] if chunk.end + 1 < n else 1.0
    return math.ceil(p.H_max * (1 - pi_open)), math.ceil(p.H_max * (1 - pi_close))  # type: ignore[operator]


@dataclass
class Candidate:
    unit: int
    score: float
    distance: int
    barrier: float


def score_candidates(chunk: Chunk, emb: Sequence[Sequence[float]], texts: Sequence[str],
                     sections: Sequence[str], pi: Sequence[float | None], p: ContextParams) -> list[Candidate]:
    """Eq. 9 for every unit in the candidate set H_i."""
    n = len(texts)
    h_minus, h_plus = horizons(chunk, pi, n, p)
    centre = _mean_unit(emb, chunk.start, chunk.end)
    chunk_refs = references(" ".join(texts[chunk.start:chunk.end + 1]))
    chunk_section = sections[chunk.start]
    pool = list(range(max(0, chunk.start - h_minus), chunk.start))
    pool += list(range(chunk.end + 1, min(n, chunk.end + 1 + h_plus)))
    out = []
    for j in pool:
        if j < chunk.start:
            dist = chunk.start - j
            between = range(j + 1, chunk.start + 1)
        else:
            dist = j - chunk.end
            between = range(chunk.end + 1, j + 1)
        barrier = max((pi[k] or 0.0) for k in between) if p.profile_guided else 0.0
        cos = sum(a * b for a, b in zip(emb[j], centre))
        r = (p.lam_e * 0.5 * (1 + cos)
             + p.lam_r * jaccard(references(texts[j]), chunk_refs)
             + p.lam_a * (1.0 if sections[j] == chunk_section else 0.0)
             - p.lam_t * barrier
             - p.lam_d * dist / p.H_max)
        out.append(Candidate(j, r, dist, barrier))
    return out


def select_context(chunk: Chunk, emb: Sequence[Sequence[float]], texts: Sequence[str],
                   tokens: Sequence[int], sections: Sequence[str], pi: Sequence[float | None],
                   p: ContextParams) -> list[int]:
    """Greedy budgeted selection; ties go to the nearer, then the earlier, unit."""
    cands = [c for c in score_candidates(chunk, emb, texts, sections, pi, p) if c.score >= p.tau_r]
    cands.sort(key=lambda c: (-c.score, c.distance, c.unit))
    chosen, used = [], 0
    for c in cands:
        if used + tokens[c.unit] <= p.B_ctx:
            chosen.append(c.unit)
            used += tokens[c.unit]
    return sorted(chosen)
