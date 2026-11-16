"""Bounded adaptive segmentation (manuscript Algorithm 1 and Eq. 7)."""

from __future__ import annotations

import math
from dataclasses import dataclass
from itertools import accumulate
from typing import Sequence


@dataclass
class SegmentParams:
    tau_b: float = 0.5
    L_min: int = 64
    L_t: int = 192
    L_max: int = 384
    gamma: float = 0.5
    eta: float = 0.0  # 0 = fixed target length (the fixed-budget ablation)

    def __post_init__(self) -> None:
        if not 0 < self.L_min <= self.L_t <= self.L_max:
            raise ValueError("require 0 < L_min <= L_t <= L_max")


@dataclass
class Chunk:
    start: int  # first unit, inclusive
    end: int    # last unit, inclusive
    tokens: int
    oversize: bool = False


def segment(tokens: Sequence[int], pi: Sequence[float | None], params: SegmentParams,
            sigma_hat: Sequence[float | None] | None = None) -> list[Chunk]:
    """Return chunks covering every unit exactly once, in order.

    ``tokens[i]`` is the token count of unit i; ``pi[i]`` is the probability of a
    cut before unit i (``pi[0]`` is ignored). ``sigma_hat`` is only needed when
    ``params.eta != 0``.
    """
    n = len(tokens)
    if n == 0:
        return []
    if len(pi) != n:
        raise ValueError("pi must have one entry per unit")
    prefix = [0, *accumulate(tokens)]

    def tok(s: int, j: int) -> int:  # tokens of units s .. j-1
        return prefix[j] - prefix[s]

    def target(s: int) -> float:
        if params.eta == 0 or sigma_hat is None or sigma_hat[s] is None:
            return float(params.L_t)
        return min(max(params.L_t * math.exp(-params.eta * sigma_hat[s]), params.L_min), params.L_max)

    cuts: list[int] = []
    s = 0
    for i in range(1, n):
        if tok(s, i + 1) > params.L_max:
            admissible = [j for j in range(s + 1, i + 1) if tok(s, j) >= params.L_min]
            if admissible:
                lt = target(s)
                best, best_score = admissible[0], -math.inf
                for j in admissible:  # ascending, so ">=" resolves ties to the later j
                    score = pi[j] - params.gamma * abs(tok(s, j) - lt) / lt  # type: ignore[operator]
                    if score >= best_score:
                        best, best_score = j, score
                c = best
            else:
                c = i
            cuts.append(c)
            s = c
        elif pi[i] is not None and pi[i] > params.tau_b and tok(s, i) >= params.L_min:
            cuts.append(i)
            s = i

    starts = [0, *cuts]
    ends = [c - 1 for c in cuts] + [n - 1]
    return [Chunk(a, b, tok(a, b + 1), oversize=tok(a, b + 1) > params.L_max) for a, b in zip(starts, ends)]


def fixed_size(tokens: Sequence[int], L: int) -> list[Chunk]:
    """Length-only baseline: greedy unit packing up to L tokens (never splits a unit)."""
    chunks: list[Chunk] = []
    start, total = 0, 0
    for i, t in enumerate(tokens):
        if i > start and total + t > L:
            chunks.append(Chunk(start, i - 1, total, total > L))
            start, total = i, 0
        total += t
    if tokens:
        chunks.append(Chunk(start, len(tokens) - 1, total, total > L))
    return chunks


def similarity_threshold(v: Sequence[float | None], tokens: Sequence[int], tau_sim: float,
                         L_max: int) -> list[Chunk]:
    """Similarity-threshold baseline: cut where cosine displacement exceeds tau_sim."""
    pi = [None] + [1.0 if (x is not None and x > tau_sim) else 0.0 for x in v[1:]]
    return segment(tokens, pi, SegmentParams(tau_b=0.5, L_min=1, L_t=L_max, L_max=L_max))


def boundaries(chunks: Sequence[Chunk]) -> list[int]:
    """Unit indices at which a new chunk starts (excluding 0)."""
    return [c.start for c in chunks[1:]]
