"""Intrinsic segmentation metrics: P_k (Beeferman et al., 1999), WindowDiff
(Pevzner and Hearst, 2002) and boundary precision/recall with a tolerance.

A segmentation of n units is given as the sorted list of unit indices at which
a new segment starts, excluding 0.
"""

from __future__ import annotations

from typing import Sequence


def _labels(starts: Sequence[int], n: int) -> list[int]:
    labels, seg, cut = [], 0, set(starts)
    for i in range(n):
        if i in cut:
            seg += 1
        labels.append(seg)
    return labels


def default_k(reference: Sequence[int], n: int) -> int:
    """Half the mean reference segment length, rounded, at least 1."""
    mean_len = n / (len(reference) + 1)
    return max(1, round(mean_len / 2))


def pk(reference: Sequence[int], hypothesis: Sequence[int], n: int, k: int | None = None) -> float:
    k = k or default_k(reference, n)
    if n <= k:
        raise ValueError("document shorter than the probe width")
    ref, hyp = _labels(reference, n), _labels(hypothesis, n)
    errors = sum((ref[i] == ref[i + k]) != (hyp[i] == hyp[i + k]) for i in range(n - k))
    return errors / (n - k)


def window_diff(reference: Sequence[int], hypothesis: Sequence[int], n: int, k: int | None = None) -> float:
    k = k or default_k(reference, n)
    if n <= k:
        raise ValueError("document shorter than the probe width")
    ref, hyp = set(reference), set(hypothesis)

    def count(cuts: set[int], i: int) -> int:  # boundaries strictly inside (i, i+k]
        return sum(1 for j in range(i + 1, i + k + 1) if j in cuts)

    errors = sum(count(ref, i) != count(hyp, i) for i in range(n - k))
    return errors / (n - k)


def boundary_prf(reference: Sequence[int], hypothesis: Sequence[int], tolerance: int = 1) -> dict[str, float]:
    """One-to-one matching of boundaries within +/- tolerance units."""
    unmatched = sorted(reference)
    tp = 0
    for h in sorted(hypothesis):
        best = None
        for r in unmatched:
            if abs(r - h) <= tolerance and (best is None or abs(r - h) < abs(best - h)):
                best = r
        if best is not None:
            unmatched.remove(best)
            tp += 1
    p = tp / len(hypothesis) if hypothesis else 0.0
    r = tp / len(reference) if reference else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return {"precision": p, "recall": r, "f1": f}
