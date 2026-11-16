/**
 * Browser port of stp_eval.profile.boundary_probabilities and
 * stp_eval.segment.segment (manuscript Eq. 6, Algorithm 1, Eq. 7).
 * src/lib/stp.test.ts checks it reproduces the Python chunking exactly.
 */
import type { ChunkTuple, SegmentParams, Weights } from "./types";

export function boundaryProbabilities(
  vHat: (number | null)[],
  aHat: (number | null)[],
  sigmaHat: (number | null)[],
  structure: number[][],
  w: Weights,
): (number | null)[] {
  const out: (number | null)[] = [null];
  for (let i = 1; i < vHat.length; i++) {
    let b = w.w_v * (vHat[i] ?? 0) + w.w_a * (aHat[i] ?? 0) + w.w_sigma * (sigmaHat[i] ?? 0) + w.beta;
    for (let k = 0; k < w.w_s.length; k++) b += w.w_s[k] * (structure[i]?.[k] ?? 0);
    out.push(1 / (1 + Math.exp(-b)));
  }
  return out;
}

/** One decision of Algorithm 1 at candidate boundary i (a cut before unit i). */
export type SegEvent =
  | { i: number; kind: "cut" | "keep" | "short" }
  | { i: number; kind: "forced"; c: number };

/** Algorithm 1 with a record of every decision, so the UI can replay it step by step. */
export function segmentTraced(
  tokens: number[],
  pi: (number | null)[],
  p: SegmentParams,
  sigmaHat?: (number | null)[],
): { chunks: ChunkTuple[]; events: SegEvent[] } {
  const n = tokens.length;
  if (n === 0) return { chunks: [], events: [] };
  const prefix = [0];
  for (const t of tokens) prefix.push(prefix[prefix.length - 1] + t);
  const tok = (s: number, j: number) => prefix[j] - prefix[s];
  const target = (s: number) => {
    const sh = sigmaHat?.[s];
    if (p.eta === 0 || sh == null) return p.L_t;
    return Math.min(Math.max(p.L_t * Math.exp(-p.eta * sh), p.L_min), p.L_max);
  };

  const cuts: number[] = [];
  const events: SegEvent[] = [];
  let s = 0;
  for (let i = 1; i < n; i++) {
    if (tok(s, i + 1) > p.L_max) {
      let c = i;
      let bestScore = -Infinity;
      let found = false;
      const lt = target(s);
      for (let j = s + 1; j <= i; j++) {
        if (tok(s, j) < p.L_min) continue;
        const score = (pi[j] ?? 0) - (p.gamma * Math.abs(tok(s, j) - lt)) / lt;
        if (score >= bestScore) {
          bestScore = score;
          c = j;
          found = true;
        }
      }
      if (!found) c = i;
      cuts.push(c);
      events.push({ i, kind: "forced", c });
      s = c;
    } else {
      const pj = pi[i];
      if (pj != null && pj > p.tau_b && tok(s, i) >= p.L_min) {
        cuts.push(i);
        events.push({ i, kind: "cut" });
        s = i;
      } else {
        events.push({ i, kind: pj != null && pj > p.tau_b ? "short" : "keep" });
      }
    }
  }
  const starts = [0, ...cuts];
  const ends = [...cuts.map((c) => c - 1), n - 1];
  return { chunks: starts.map((a, k) => [a, ends[k], tok(a, ends[k] + 1)] as ChunkTuple), events };
}

export function segment(
  tokens: number[],
  pi: (number | null)[],
  p: SegmentParams,
  sigmaHat?: (number | null)[],
): ChunkTuple[] {
  return segmentTraced(tokens, pi, p, sigmaHat).chunks;
}

export interface Scaler { center: number; scale: number }

/**
 * Eqs. 1-5 from neighbour similarities: velocity v = 1 - cos, positive acceleration,
 * trailing-window volatility, then robust scaling with fitted scalers (stp_eval.profile).
 */
export function profileFromSims(sims: (number | null)[], window: number, sc: { v: Scaler; a: Scaler; sigma: Scaler }) {
  const n = sims.length;
  const v: (number | null)[] = sims.map((x, i) => (i === 0 || x == null ? null : 1 - x));
  const a: (number | null)[] = Array(n).fill(null);
  if (n > 1) a[1] = 0;
  for (let i = 2; i < n; i++) a[i] = Math.max(0, (v[i] as number) - (v[i - 1] as number));
  const sigma: (number | null)[] = Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    const win: number[] = [];
    for (let j = Math.max(1, i - window + 1); j <= i; j++) win.push(v[j] as number);
    const m = win.reduce((x, y) => x + y, 0) / win.length;
    sigma[i] = Math.sqrt(win.reduce((x, y) => x + (y - m) ** 2, 0) / win.length);
  }
  const scale = (xs: (number | null)[], s: Scaler) => xs.map((x) => (x == null ? null : (x - s.center) / s.scale));
  return { v, a, sigma, v_hat: scale(v, sc.v), a_hat: scale(a, sc.a), sigma_hat: scale(sigma, sc.sigma) };
}

export interface ChunkStats {
  count: number;
  meanTokens: number;
  sdTokens: number;
  headingCuts: number;
  headings: number;
}

export function chunkStats(chunks: ChunkTuple[], headingUnits: number[]): ChunkStats {
  const toks = chunks.map((c) => c[2]);
  const mean = toks.reduce((a, b) => a + b, 0) / Math.max(1, toks.length);
  const sd = Math.sqrt(toks.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, toks.length));
  const starts = new Set(chunks.map((c) => c[0]));
  const inner = headingUnits.filter((h) => h > 0);
  return {
    count: chunks.length,
    meanTokens: mean,
    sdTokens: sd,
    headingCuts: inner.filter((h) => starts.has(h)).length,
    headings: inner.length,
  };
}
