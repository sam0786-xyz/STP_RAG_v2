"""Evaluation harness for the STP-RAG confirmatory protocol.

Every module maps to a part of the v2 manuscript:

  profile.py       Eqs. 1-6   semantic transition profile and boundary probabilities
  segment.py       Alg. 1, Eq. 7   bounded adaptive segmentation
  context.py       Eqs. 8-9   profile-guided selective context
  budget.py        Sec. 5.2   matched prompt and retrieval token budgets
  metrics.py       Sec. 5.4   retrieval, answer and mechanism metrics
  segmentation_metrics.py    P_k, WindowDiff, boundary precision/recall
  stats.py         Sec. 5.5   paired / clustered bootstrap, permutation test, Holm
  records.py       Sec. 5.6   per-query JSONL records and checksum manifest
  report.py        builds the run bundle that the dashboard loads

Standard library only, so the harness runs anywhere the pilot code runs.
"""

__version__ = "0.1.0"
