"""Matched token budgets (manuscript Section 5.2)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence


@dataclass
class RankedChunk:
    chunk_id: str
    unit_tokens: list[int]            # base units of the chunk, in order
    context_tokens: list[int] = field(default_factory=list)  # attached context units
    span: tuple[int, int] | None = None  # base-text character span (start, end) for credit

    @property
    def tokens(self) -> int:
        return sum(self.unit_tokens) + sum(self.context_tokens)


@dataclass
class Packed:
    chunk_id: str
    tokens_used: int
    truncated: bool
    span: tuple[int, int] | None


def pack(ranked: Sequence[RankedChunk], budget: int) -> list[Packed]:
    """Pack chunks in rank order into ``budget`` tokens.

    Context counts against the budget. The last chunk is truncated at a unit
    boundary: whole base units are kept while they fit, and its context is
    dropped. Packing stops at the first chunk that cannot contribute a unit.
    """
    out: list[Packed] = []
    used = 0
    for rc in ranked:
        if used + rc.tokens <= budget:
            out.append(Packed(rc.chunk_id, rc.tokens, False, rc.span))
            used += rc.tokens
            continue
        room, kept = budget - used, 0
        for t in rc.unit_tokens:
            if kept + t > room:
                break
            kept += t
        if kept:
            out.append(Packed(rc.chunk_id, kept, True, rc.span))
        break
    return out


def prompt_tokens(packed: Sequence[Packed]) -> int:
    return sum(p.tokens_used for p in packed)
