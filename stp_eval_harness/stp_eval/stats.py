"""Paired inference (manuscript Section 5.5).

* paired bootstrap over queries (HotpotQA);
* cluster bootstrap that resamples documents with all their queries (QASPER),
  following Field and Welsh (2007);
* paired sign-flip permutation test (two-sided), optionally flipping whole clusters;
* Holm-Bonferroni adjustment (Holm, 1979).

Inputs are per-query differences d_i = metric(arm, q_i) - metric(baseline, q_i).
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Sequence


@dataclass
class Interval:
    mean: float
    low: float
    high: float
    n_units: int
    resamples: int
    method: str

    def excludes_zero(self) -> bool:
        return self.low > 0 or self.high < 0


def _percentile(sorted_xs: Sequence[float], q: float) -> float:
    pos = (len(sorted_xs) - 1) * q
    lo = int(pos)
    hi = min(lo + 1, len(sorted_xs) - 1)
    return sorted_xs[lo] + (sorted_xs[hi] - sorted_xs[lo]) * (pos - lo)


def paired_bootstrap(diffs: Sequence[float], resamples: int = 10_000, level: float = 0.95,
                     seed: int = 0) -> Interval:
    if not diffs:
        raise ValueError("no paired observations")
    rng = random.Random(seed)
    n = len(diffs)
    means = sorted(sum(diffs[rng.randrange(n)] for _ in range(n)) / n for _ in range(resamples))
    a = (1 - level) / 2
    return Interval(sum(diffs) / n, _percentile(means, a), _percentile(means, 1 - a), n, resamples,
                    "paired percentile bootstrap over queries")


def _group(diffs: Sequence[float], clusters: Sequence[str]) -> list[list[float]]:
    if len(diffs) != len(clusters):
        raise ValueError("one cluster label per difference")
    groups: dict[str, list[float]] = {}
    for d, c in zip(diffs, clusters):
        groups.setdefault(c, []).append(d)
    return list(groups.values())


def cluster_bootstrap(diffs: Sequence[float], clusters: Sequence[str], resamples: int = 10_000,
                      level: float = 0.95, seed: int = 0) -> Interval:
    """Resample clusters with replacement; the statistic is the mean over all included queries."""
    groups = _group(diffs, clusters)
    rng = random.Random(seed)
    g = len(groups)
    stats = []
    for _ in range(resamples):
        total, count = 0.0, 0
        for _ in range(g):
            grp = groups[rng.randrange(g)]
            total += sum(grp)
            count += len(grp)
        stats.append(total / count)
    stats.sort()
    a = (1 - level) / 2
    return Interval(sum(diffs) / len(diffs), _percentile(stats, a), _percentile(stats, 1 - a), g,
                    resamples, "cluster percentile bootstrap over documents")


def sign_flip_test(diffs: Sequence[float], clusters: Sequence[str] | None = None,
                   permutations: int = 10_000, seed: int = 0) -> float:
    """Two-sided p-value for H0: the arm and the baseline are exchangeable.

    With ``clusters`` the signs of whole clusters are flipped together. The
    p-value includes the observed statistic, so it is never exactly zero.
    """
    groups = _group(diffs, clusters) if clusters is not None else [[d] for d in diffs]
    sums = [sum(g) for g in groups]
    n = sum(len(g) for g in groups)
    observed = abs(sum(sums) / n)
    rng = random.Random(seed)
    extreme = 0
    for _ in range(permutations):
        stat = abs(sum(s if rng.random() < 0.5 else -s for s in sums) / n)
        if stat >= observed - 1e-12:
            extreme += 1
    return (extreme + 1) / (permutations + 1)


def holm(pvalues: dict[str, float]) -> dict[str, float]:
    """Holm-Bonferroni adjusted p-values (monotone, capped at 1)."""
    order = sorted(pvalues, key=pvalues.get)  # type: ignore[arg-type]
    m = len(order)
    adjusted: dict[str, float] = {}
    running = 0.0
    for rank, key in enumerate(order):
        running = max(running, min(1.0, (m - rank) * pvalues[key]))
        adjusted[key] = running
    return adjusted
