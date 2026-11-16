/** Content transcribed from research_paper_v2 (Tables 3 and 4, Sections 4-5). */

export type Status = "Consistent" | "Partial" | "Unverified" | "Differs" | "Conflict" | "Contaminated" | "Missing" | "Branch B (inferred)";

export interface ReconcileRow {
  component: string;
  reference: string;
  pilot: string;
  status: Status;
}

export const RECONCILE: ReconcileRow[] = [
  { component: "Base unit", reference: "Sentence; Δp = 1", pilot: "Structure-aware sentence units; STP computed with cumulative token positions, implying token-scaled progression", status: "Differs" },
  { component: "Encoder", reference: "One pinned BGE model and revision", pilot: "bge-small-en-v1.5 in the retrieval config; bge-m3 default in precomputation; revisions unpinned", status: "Conflict" },
  { component: "Acceleration", reference: "Positive part a⁺", pilot: "Present; sign handling not confirmed", status: "Unverified" },
  { component: "Volatility", reference: "Trailing population SD over w units", pilot: "Present; window and initialisation not released", status: "Unverified" },
  { component: "Normalisation", reference: "Development median/IQR with a fallback chain", pilot: "Stored normalisation statistics; no fallback", status: "Partial" },
  { component: "Structure", reference: "Binary vector s", pilot: "Scalar structural score", status: "Differs" },
  { component: "Velocity-only arm", reference: "w_a = w_σ = 0 and w_s = 0", pilot: "Structural weight w_s active", status: "Contaminated" },
  { component: "Context direction", reference: "Preceding and following units", pilot: "Predecessor units only", status: "Differs" },
  { component: "Profile in context", reference: "Horizon (Eq. 8) and barrier T", pilot: "Per-chunk horizon and threshold; dependence on the profile not released", status: "Unverified" },
  { component: "Placement", reference: "Declared branch A or B", pilot: "Augmented text used in the prompt; retrieval scores unchanged by context", status: "Branch B (inferred)" },
  { component: "Prompt evidence", reference: "Matched token budget", pilot: "Fixed top-3 chunks; Recall at top-5", status: "Differs" },
  { component: "Generator", reference: "Pinned digest, temperature 0", pilot: "phi3:mini tag; quantisation and digest unrecorded", status: "Partial" },
  { component: "Records", reference: "Per-query JSONL and manifest", pilot: "Aggregate scalars only", status: "Missing" },
];

export const STATUS_TONE: Record<Status, "ok" | "warn" | "bad"> = {
  Consistent: "ok",
  "Branch B (inferred)": "warn",
  Partial: "warn",
  Unverified: "warn",
  Differs: "bad",
  Conflict: "bad",
  Contaminated: "bad",
  Missing: "bad",
};

export interface Arm {
  name: string;
  v: boolean;
  a: boolean;
  sigma: boolean;
  s: boolean;
  eta: boolean;
  question: string;
}

export const ARMS: Arm[] = [
  { name: "Fixed-size (four sizes)", v: false, a: false, sigma: false, s: false, eta: false, question: "Length-only baseline" },
  { name: "Structure only", v: false, a: false, sigma: false, s: true, eta: false, question: "Value of headings and paragraphs alone" },
  { name: "Velocity only", v: true, a: false, sigma: false, s: false, eta: false, question: "Clean first-order baseline" },
  { name: "Velocity + structure", v: true, a: false, sigma: false, s: true, eta: false, question: "Reproduces the pilot's “velocity-only” arm" },
  { name: "Acceleration only", v: false, a: true, sigma: false, s: false, eta: false, question: "Second-order signal alone" },
  { name: "Volatility only", v: false, a: false, sigma: true, s: false, eta: false, question: "Dispersion signal alone" },
  { name: "Kinematics only", v: true, a: true, sigma: true, s: false, eta: false, question: "STP without structural cues" },
  { name: "Full boundary, fixed target", v: true, a: true, sigma: true, s: true, eta: false, question: "Boundaries without length adaptation" },
  { name: "Full STP", v: true, a: true, sigma: true, s: true, eta: true, question: "Proposed method" },
];

export const CONTEXT_POLICIES = [
  "No context",
  "Naive neighbouring window (equal tokens)",
  "Relevance-only selector (λ_t = 0, fixed horizon)",
  "Profile-guided selector (Eqs. 8–9)",
];

export const HYPOTHESES = [
  { id: "H1", text: "At a 1,024-token prompt budget, full STP with profile-guided context has higher answer F1 than length-matched fixed-size chunking with relevance-only context.", metric: "Answer F1" },
  { id: "H2", text: "Full STP has a lower evidence split rate than length-matched fixed-size chunking.", metric: "Evidence split rate" },
  { id: "H3", text: "On the same base chunks, profile-guided context has higher context precision than relevance-only context.", metric: "Context precision" },
  { id: "H4", text: "Kinematics only achieves higher Recall@1024 tokens than structure only.", metric: "Recall@1024 tokens" },
];

export const AUDIT_FACTS = [
  { value: "25", label: "generated answers scored per dataset", detail: "One extra exact answer moves EM by 0.04." },
  { value: "42 of 149", label: "QASPER questions dropped", detail: "Substring evidence alignment failed (28.2%)." },
  { value: "≈960 vs 345", label: "prompt tokens, fixed-size vs full STP", detail: "Fixed top-3 retrieval; full STP with context ≈945." },
  { value: "3", label: "seeds, but deterministic retrieval", detail: "Seed-level bootstrap intervals were invalid." },
];

/** Okabe–Ito colours used by the paper's figures (results/plot_styles.tex). */
export const ARM_COLOR: Record<string, string> = {
  fixed: "#3B3B3B",
  similarity: "#8C8C8C",
  vel_struct: "#0072B2",
  vel_acc: "#E69F00",
  full_stp: "#009E73",
  full_stp_ctx: "#CC79A7",
};

export const METHOD_COLOR = { fixed: "#3B3B3B", similarity: "#8C8C8C", stp: "#009E73" } as const;
export const METHOD_LABEL = { fixed: "Fixed-size", similarity: "Similarity threshold", stp: "STP (reference)" } as const;
