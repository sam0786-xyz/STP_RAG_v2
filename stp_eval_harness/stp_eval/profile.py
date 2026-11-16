"""Semantic transition profile (manuscript Eqs. 1-6).

Indexing convention: units are 0-indexed here. A candidate boundary ``i``
(1 <= i < n) is a cut between unit i-1 and unit i, matching the manuscript's
"boundary at position i" with its 1-indexed units shifted by one. Position 0
has no velocity, acceleration or boundary and stores ``None``.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from statistics import median
from typing import Sequence

Vector = Sequence[float]

N_STRUCT = 5  # heading, paragraph, list item, display equation, table/figure


def _dot(a: Vector, b: Vector) -> float:
    return sum(x * y for x, y in zip(a, b))


def l2_normalise(v: Vector) -> list[float]:
    norm = math.sqrt(_dot(v, v))
    if norm == 0:
        raise ValueError("cannot normalise a zero vector")
    return [x / norm for x in v]


def velocity(emb: Sequence[Vector]) -> list[float | None]:
    """Eq. 1: v_i = 1 - e_{i-1}^T e_i for i >= 1. Embeddings must be L2-normalised."""
    out: list[float | None] = [None]
    for i in range(1, len(emb)):
        out.append(1.0 - _dot(emb[i - 1], emb[i]))
    return out


def positive_acceleration(v: Sequence[float | None]) -> list[float | None]:
    """Eq. 2: a_i^+ = max(0, v_i - v_{i-1}); the first defined value is 0."""
    out: list[float | None] = [None] * len(v)
    if len(v) > 1:
        out[1] = 0.0
    for i in range(2, len(v)):
        out[i] = max(0.0, v[i] - v[i - 1])  # type: ignore[operator]
    return out


def volatility(v: Sequence[float | None], w: int) -> list[float | None]:
    """Eq. 3: population SD of velocity over a trailing window of <= w valid values."""
    if w < 1:
        raise ValueError("window must be >= 1")
    out: list[float | None] = [None] * len(v)
    for i in range(1, len(v)):
        window = [v[j] for j in range(max(1, i - w + 1), i + 1)]
        mean = sum(window) / len(window)  # type: ignore[arg-type]
        out[i] = math.sqrt(sum((x - mean) ** 2 for x in window) / len(window))  # type: ignore[operator]
    return out


@dataclass
class RobustScaler:
    """Eq. 4: median / IQR scaling fitted on development data, with a fallback chain.

    The chain IQR -> 1.4826*MAD -> SD -> 1 prevents a degenerate scale; the
    method actually used is recorded in ``method`` so it can be reported.
    """

    eps: float = 1e-6
    center: float = 0.0
    scale: float = 1.0
    method: str = "unfitted"

    def fit(self, values: Sequence[float]) -> "RobustScaler":
        xs = sorted(x for x in values if x is not None)
        if not xs:
            raise ValueError("no values to fit")
        self.center = median(xs)
        iqr = _quantile(xs, 0.75) - _quantile(xs, 0.25)
        mad = median(abs(x - self.center) for x in xs)
        mean = sum(xs) / len(xs)
        sd = math.sqrt(sum((x - mean) ** 2 for x in xs) / len(xs))
        if iqr > self.eps:
            self.scale, self.method = iqr, "iqr"
        elif mad > self.eps:
            self.scale, self.method = 1.4826 * mad, "mad"
        elif sd > self.eps:
            self.scale, self.method = sd, "sd"
        else:
            self.scale, self.method = 1.0, "unit"
        return self

    def transform(self, values: Sequence[float | None]) -> list[float | None]:
        return [None if x is None else (x - self.center) / self.scale for x in values]


def _quantile(sorted_xs: Sequence[float], q: float) -> float:
    """Linear-interpolation quantile (type 7, the numpy default)."""
    if len(sorted_xs) == 1:
        return float(sorted_xs[0])
    pos = (len(sorted_xs) - 1) * q
    lo = math.floor(pos)
    hi = min(lo + 1, len(sorted_xs) - 1)
    return sorted_xs[lo] + (sorted_xs[hi] - sorted_xs[lo]) * (pos - lo)


@dataclass
class Profile:
    """Raw and normalised signals for one document."""

    v: list[float | None]
    a: list[float | None]
    sigma: list[float | None]
    structure: list[list[int]]  # one length-5 binary vector per unit
    v_hat: list[float | None] = field(default_factory=list)
    a_hat: list[float | None] = field(default_factory=list)
    sigma_hat: list[float | None] = field(default_factory=list)

    @property
    def n(self) -> int:
        return len(self.v)


def compute_profile(emb: Sequence[Vector], structure: Sequence[Sequence[int]] | None, w: int) -> Profile:
    n = len(emb)
    if structure is None:
        structure = [[0] * N_STRUCT for _ in range(n)]
    if len(structure) != n:
        raise ValueError("structure must have one vector per unit")
    v = velocity(emb)
    return Profile(v=v, a=positive_acceleration(v), sigma=volatility(v, w),
                   structure=[list(s) for s in structure])


@dataclass
class Scalers:
    v: RobustScaler
    a: RobustScaler
    sigma: RobustScaler

    @classmethod
    def fit(cls, dev_profiles: Sequence[Profile], eps: float = 1e-6) -> "Scalers":
        def pool(attr: str) -> list[float]:
            return [x for p in dev_profiles for x in getattr(p, attr) if x is not None]

        return cls(RobustScaler(eps).fit(pool("v")), RobustScaler(eps).fit(pool("a")),
                   RobustScaler(eps).fit(pool("sigma")))

    def apply(self, p: Profile) -> Profile:
        p.v_hat = self.v.transform(p.v)
        p.a_hat = self.a.transform(p.a)
        p.sigma_hat = self.sigma.transform(p.sigma)
        return p

    def methods(self) -> dict[str, str]:
        return {"v": self.v.method, "a": self.a.method, "sigma": self.sigma.method}


@dataclass
class BoundaryWeights:
    w_v: float = 1.0
    w_a: float = 0.0
    w_sigma: float = 0.0
    w_s: tuple[float, ...] = (0.0,) * N_STRUCT
    beta: float = 0.0


def boundary_probabilities(p: Profile, wts: BoundaryWeights) -> list[float | None]:
    """Eq. 6: b_i = w.z_i + beta and pi_i = logistic(b_i), for candidates i >= 1."""
    if not p.v_hat:
        raise ValueError("apply fitted Scalers before computing boundary probabilities")
    out: list[float | None] = [None]
    for i in range(1, p.n):
        b = (wts.w_v * p.v_hat[i] + wts.w_a * p.a_hat[i] + wts.w_sigma * p.sigma_hat[i]  # type: ignore[operator]
             + sum(ws * s for ws, s in zip(wts.w_s, p.structure[i])) + wts.beta)
        out.append(1.0 / (1.0 + math.exp(-b)))
    return out
