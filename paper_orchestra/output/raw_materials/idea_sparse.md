# STP-RAG: Semantic Transition Profiles for Adaptive Chunking and Selective Context

## Research problem

Retrieval-augmented generation (RAG) normally indexes fixed-size passages. Fixed
boundaries are convenient but can split definitions from qualifications or merge
unrelated material. This project studies whether local changes in sentence
embeddings can be used as one interpretable control signal for (1) adaptive
chunk boundaries and (2) selective context expansion.

## Method to describe

Represent each document as ordered sentence units with source offsets and
structural metadata. Embed each unit with a fixed, L2-normalized encoder. For a
candidate boundary, compute semantic velocity (adjacent embedding distance),
positive acceleration (increase in velocity), trailing-window volatility, and
structural indicators such as heading and paragraph changes. Robustly normalize
continuous features using development-only median/IQR statistics. A weighted
boundary score is subject to minimum, target, and maximum length constraints.

For a retrieved chunk, rank nearby source units using embedding relevance,
structural affinity, reference/entity overlap, and distance; append units only
until a declared context-token budget is exhausted. Preserve source provenance
for every chunk and attached unit.

## Claims that are allowed

- The paper proposes a reference specification and confirmatory protocol, plus
  audited pilot aggregates.
- Pilot results are descriptive only. They do **not** establish universal
  superiority, causal effects, statistical significance, or deployment speed.
- The supplied implementation audit identifies constraints: only 25 queries
  contribute to generation metrics, 42 of 149 QASPER questions are lost during
  evidence alignment, the nominal velocity arm includes structural weighting,
  and context/token budgets are not matched.

## Contributions

1. An explicit transition-profile formulation for adaptive RAG segmentation and
   provenance-preserving selective context.
2. A transparent presentation of mixed pilot findings on HotpotQA and QASPER.
3. A confirmatory evaluation harness with paired records, budget controls,
   intrinsic segmentation metrics, and document-clustered inference.

## Writing requirements

Write a careful empirical-systems paper, not a marketing paper. Maintain a
clear separation among reference method, current implementation, and pilot
results. Cite only verifiable literature. Describe the evaluation limitations
in the abstract, results, and limitations sections. Do not fabricate
experiments, hyperparameters, sample sizes, confidence intervals, hardware, or
baseline results. Do not call this work submission-ready until the confirmatory
protocol has been executed.
