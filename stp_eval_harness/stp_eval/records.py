"""Per-query JSONL records and the SHA-256 manifest (manuscript Section 5.6).

One record per (arm, query). The schema is deliberately flat so that a run can
be inspected with ``jq`` and loaded by the dashboard without this package.
"""

from __future__ import annotations

import gzip
import hashlib
import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable, Iterator

SCHEMA_VERSION = 1


@dataclass
class RetrievedChunk:
    chunk_id: str
    score: float
    tokens: int
    span: tuple[int, int]                 # base-text character span in the source document
    context_spans: list[tuple[int, int]] = field(default_factory=list)
    context_tokens: int = 0


@dataclass
class QueryRecord:
    dataset: str
    arm: str
    query_id: str
    doc_id: str                            # cluster unit for the document bootstrap
    question: str
    gold_answers: list[str]
    gold_spans: list[tuple[int, int]]
    retrieved: list[RetrievedChunk]
    prompt: str
    prompt_tokens: int
    raw_generation: str
    prediction: str
    metrics: dict[str, float | None]       # e.g. recall@5, mrr@10, recall@1024tok, em, f1
    budget: int | None = None              # prompt budget in tokens, if a matched regime
    question_type: str | None = None       # bridge / comparison / extractive / ...
    schema_version: int = SCHEMA_VERSION

    def to_json(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False, sort_keys=True)

    @classmethod
    def from_dict(cls, d: dict) -> "QueryRecord":
        d = dict(d)
        d["retrieved"] = [RetrievedChunk(**{**r, "span": tuple(r["span"]),
                                             "context_spans": [tuple(s) for s in r.get("context_spans", [])]})
                          for r in d.get("retrieved", [])]
        d["gold_spans"] = [tuple(s) for s in d.get("gold_spans", [])]
        return cls(**d)


def _open(path: Path, mode: str):
    return gzip.open(path, mode + "t", encoding="utf-8") if path.suffix == ".gz" else open(path, mode, encoding="utf-8")


def write_records(path: str | Path, records: Iterable[QueryRecord]) -> int:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with _open(path, "w") as fh:
        for r in records:
            fh.write(r.to_json() + "\n")
            n += 1
    return n


def read_records(path: str | Path) -> Iterator[QueryRecord]:
    with _open(Path(path), "r") as fh:
        for line_no, line in enumerate(fh, start=1):
            if not line.strip():
                continue
            try:
                yield QueryRecord.from_dict(json.loads(line))
            except (TypeError, KeyError, json.JSONDecodeError) as exc:
                raise ValueError(f"{path}:{line_no}: invalid record ({exc})") from exc


def sha256_file(path: str | Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1 << 16), b""):
            h.update(block)
    return h.hexdigest()


def write_manifest(paths: Iterable[str | Path], out: str | Path, extra: dict | None = None) -> dict:
    """Checksum every artifact (splits, configs, prompt template, predictions)."""
    manifest = {"schema_version": SCHEMA_VERSION,
                "files": {str(p): sha256_file(p) for p in sorted(map(str, paths))},
                **(extra or {})}
    Path(out).write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    return manifest


def verify_manifest(path: str | Path) -> list[str]:
    """Return the files whose current checksum differs from the manifest."""
    manifest = json.loads(Path(path).read_text())
    return [p for p, digest in manifest["files"].items() if not Path(p).exists() or sha256_file(p) != digest]
