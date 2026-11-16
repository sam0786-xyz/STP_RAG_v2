export type MethodKey = "fixed" | "similarity" | "stp";

export interface Unit {
  text: string;
  section: string;
  subsection: string;
  heading: boolean;
  para: boolean;
  tokens: number;
  start: number;
  end: number;
}

export interface Weights {
  w_v: number;
  w_a: number;
  w_sigma: number;
  w_s: number[];
  beta: number;
}

export interface SegmentParams {
  tau_b: number;
  L_min: number;
  L_t: number;
  L_max: number;
  gamma: number;
  eta: number;
}

/** [start, end (inclusive), tokens] */
export type ChunkTuple = [number, number, number];

export interface MethodRetrieval {
  ranking: { chunk: number; score: number }[];
  topk_tokens: number;
  topk_recall: number;
  mrr: number;
  budget_chunks: number[];
  budget_tokens: number;
  budget_recall: number;
  split_rate: number;
}

export interface DemoQuestion {
  question: string;
  gold_units: number[];
  methods: Record<MethodKey, MethodRetrieval>;
}

export interface Demo {
  generated: string;
  document: { title: string; source: string; sha256: string };
  encoder: { name: string; runtime: string; normalised: boolean };
  notes: string[];
  units: Unit[];
  signals: {
    v: (number | null)[];
    a: (number | null)[];
    sigma: (number | null)[];
    v_hat: (number | null)[];
    a_hat: (number | null)[];
    sigma_hat: (number | null)[];
    structure: number[][];
    pi: (number | null)[];
    scaler_methods: Record<string, string>;
  };
  weights: Weights;
  params: SegmentParams;
  fixed_L: number;
  similarity: { percentile: number; tau: number };
  context_params: Record<string, number | boolean>;
  retrieval: { top_k: number; prompt_budget: number };
  chunkings: Record<MethodKey, ChunkTuple[]>;
  context: { stp: number[][]; fixed: number[][] };
  questions: DemoQuestion[];
}

export interface PilotRow {
  dataset: "HotpotQA" | "QASPER";
  method: string;
  arm: string;
  recall_mean: number;
  recall_sd: number;
  mrr_mean: number;
  mrr_sd: number;
  em_mean: number;
  em_sd: number;
  em_count: number;
  f1_mean: number;
  f1_sd: number;
  chunks_mean: number;
  build_mean: number;
  build_sd: number;
  latency_mean: number;
  latency_sd: number;
}

export interface Pilot {
  source: string;
  generation_queries: number;
  retrieval_queries: Record<string, number>;
  qasper_dropped: { dropped: number; total: number };
  arms: Record<string, { label: string; short: string; key: string; legacy_name: string }>;
  rows: PilotRow[];
}

/** Bundle written by stp_eval.report */
export interface RunComparison {
  delta: number;
  ci_low: number;
  ci_high: number;
  p: number;
  p_holm?: number;
  n_pairs: number;
  n_units: number;
  method: string;
}

export interface RunQuery {
  query_id: string;
  doc_id: string;
  question: string;
  gold_answers: string[];
  type: string | null;
  arms: Record<string, {
    prediction: string;
    prompt_tokens: number;
    metrics: Record<string, number | null>;
    retrieved: { id: string; score: number; tokens: number; context_tokens: number }[];
  }>;
}

export interface RunDataset {
  clustered: boolean;
  baseline: string;
  arms: Record<string, Record<string, number | null>>;
  comparisons: Record<string, Record<string, RunComparison>>;
  queries: RunQuery[];
}

export interface RunBundle {
  kind: "stp-eval-run";
  harness_version: string;
  created: string;
  resamples: number;
  seed: number;
  metrics: string[];
  files: Record<string, string>;
  datasets: Record<string, RunDataset>;
  synthetic?: boolean;
}
