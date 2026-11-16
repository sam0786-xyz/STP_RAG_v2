/**
 * Six chunking techniques over a Doc, sized in words. Each returns its chunks as word ranges,
 * a step-by-step trace for the Play button, and (for the two meaning-based ones) the signal it cut on.
 */
import type { Doc } from "./doc";
import { sentenceOfWord } from "./doc";
import type { PlaygroundData } from "./doc";
import { boundaryProbabilities, profileFromSims, segmentTraced } from "./stp";

export type TechId = "fixed" | "overlap" | "sentence" | "recursive" | "semantic" | "stp";

export interface Settings {
  fixed: { size: number };
  overlap: { size: number; overlap: number };
  sentence: { per: number };
  recursive: { max: number };
  semantic: { pct: number };
  stp: { tau: number; max: number };
}

export const DEFAULTS: Settings = {
  fixed: { size: 50 },
  overlap: { size: 50, overlap: 12 },
  sentence: { per: 3 },
  recursive: { max: 80 },
  semantic: { pct: 15 },
  stp: { tau: 0.5, max: 90 },
};

/** The similarity baseline never lets a chunk grow past this, as in stp_eval.segment.similarity_threshold. */
export const SEMANTIC_CAP = 150;

export const TECHS: { id: TechId; name: string; how: string; needsModel: boolean }[] = [
  { id: "fixed", name: "Fixed size", needsModel: false,
    how: "Counts words and cuts every N, wherever that lands, even in the middle of a sentence." },
  { id: "overlap", name: "Fixed + overlap", needsModel: false,
    how: "Fixed size, but each chunk starts a few words before the previous one ended, so text near a cut appears in two chunks." },
  { id: "sentence", name: "Sentences", needsModel: false,
    how: "Puts a set number of whole sentences in each chunk, whatever they are about." },
  { id: "recursive", name: "Recursive", needsModel: false,
    how: "Splits at paragraph breaks first, then at sentences, then at words, until every piece fits; small neighbours are merged up to the limit." },
  { id: "semantic", name: "Semantic", needsModel: true,
    how: "Embeds every sentence and cuts where two neighbouring sentences are least alike." },
  { id: "stp", name: "STP (ours)", needsModel: true,
    how: "Scores every gap between sentences from how far the topic moves, whether the move is speeding up, how unsettled the text is, and paragraph breaks. It cuts where the score is high, within size limits." },
];

export const techName = (t: TechId) => TECHS.find((x) => x.id === t)!.name;

/** A chunk is the word range [start, end). */
export interface Chunk { start: number; end: number }

export interface Step {
  /** words before this index have been read */
  cursor: number;
  /** chunks finished so far */
  done: number;
  kind: "cut" | "keep" | "short" | "forced" | "end";
  note: string;
  /** where a cut was placed: before sentence `gap` (sentence-level techniques only) */
  gap?: number;
  /** the gap the reader had reached when deciding (differs from `gap` for a forced cut) */
  decided?: number;
}

export interface Signal {
  label: string;
  /** one value per sentence gap: values[i] is the gap before sentence i (index 0 unused) */
  values: (number | null)[];
  threshold: number;
  thresholdLabel: string;
  format: (x: number) => string;
}

export interface Result {
  chunks: Chunk[];
  /** why chunk k starts where it does (k >= 1) */
  why: string[];
  steps: Step[];
  signal?: Signal;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function midSentence(sentOf: Int32Array, b: number): boolean {
  return b > 0 && b < sentOf.length && sentOf[b] === sentOf[b - 1];
}

function quote(doc: Doc, w: number): string {
  return `“${doc.words[w].replace(/[“”"]/g, "")}”`;
}

/** Chunks over whole sentences -> word ranges. */
function fromSentenceRanges(doc: Doc, ranges: [number, number][]): Chunk[] {
  return ranges.map(([a, b]) => ({ start: doc.sentences[a].w0, end: doc.sentences[b].w0 + doc.sentences[b].n }));
}

function endStep(chunks: Chunk[]): Step {
  const last = chunks[chunks.length - 1];
  return { cursor: last.end, done: chunks.length, kind: "end",
    note: `End of the text. The last chunk has ${plural(last.end - last.start, "word")}; ${plural(chunks.length, "chunk")} in all.` };
}

function fixed(doc: Doc, size: number): Result {
  const n = doc.words.length;
  const sentOf = sentenceOfWord(doc);
  const chunks: Chunk[] = [];
  for (let s = 0; s < n; s += size) chunks.push({ start: s, end: Math.min(n, s + size) });
  const why = [""];
  const steps: Step[] = [];
  chunks.forEach((c, k) => {
    if (k === chunks.length - 1) return;
    const mid = midSentence(sentOf, c.end);
    why.push(`Starts after exactly ${size} words${mid ? ". This cut lands in the middle of a sentence." : "."}`);
    steps.push({ cursor: c.end, done: k + 1, kind: "cut",
      note: `Chunk ${k + 1} is full at ${size} words, so it ends after ${quote(doc, c.end - 1)}${mid ? ", in the middle of a sentence" : ""}.` });
  });
  if (chunks.length) steps.push(endStep(chunks));
  return { chunks, why, steps };
}

function overlap(doc: Doc, size: number, ov: number): Result {
  const n = doc.words.length;
  const stride = Math.max(1, size - ov);
  const sentOf = sentenceOfWord(doc);
  const chunks: Chunk[] = [];
  for (let s = 0; ; s += stride) {
    const e = Math.min(n, s + size);
    chunks.push({ start: s, end: e });
    if (e >= n) break;
  }
  const why = [""];
  const steps: Step[] = [];
  chunks.forEach((c, k) => {
    if (k === chunks.length - 1) return;
    const next = chunks[k + 1];
    why.push(`Starts ${c.end - next.start} words before chunk ${k + 1} ends, so those words are in both.`);
    steps.push({ cursor: c.end, done: k + 1, kind: "cut",
      note: `Chunk ${k + 1} is full at ${size} words${midSentence(sentOf, c.end) ? ", mid-sentence" : ""}. Chunk ${k + 2} starts ${c.end - next.start} words earlier, at ${quote(doc, next.start)}, so those words appear twice.` });
  });
  if (chunks.length) steps.push(endStep(chunks));
  return { chunks, why, steps };
}

function sentences(doc: Doc, per: number): Result {
  const m = doc.sentences.length;
  const ranges: [number, number][] = [];
  for (let a = 0; a < m; a += per) ranges.push([a, Math.min(m, a + per) - 1]);
  const chunks = fromSentenceRanges(doc, ranges);
  const why = ranges.map((_, k) => (k === 0 ? "" : `Starts after ${plural(per, "sentence")}, whatever they were about.`));
  const steps: Step[] = ranges.slice(0, -1).map(([, b], k) => ({
    cursor: chunks[k].end, done: k + 1, kind: "cut" as const, gap: b + 1,
    note: `${plural(per, "sentence")} collected, so chunk ${k + 1} ends after sentence ${b + 1}.`,
  }));
  if (chunks.length) steps.push(endStep(chunks));
  return { chunks, why, steps };
}

function recursive(doc: Doc, max: number): Result {
  type Atom = { start: number; end: number; kind: "paragraph" | "sentence" | "words"; first: boolean };
  const atoms: Atom[] = [];
  const S = doc.sentences;
  for (let a = 0; a < S.length; ) {
    let b = a + 1;
    while (b < S.length && !S[b].paraStart) b++;
    const start = S[a].w0;
    const end = S[b - 1].w0 + S[b - 1].n;
    if (end - start <= max) atoms.push({ start, end, kind: "paragraph", first: true });
    else {
      for (let i = a; i < b; i++) {
        const s = S[i];
        if (s.n <= max) atoms.push({ start: s.w0, end: s.w0 + s.n, kind: "sentence", first: i === a });
        else for (let w = s.w0; w < s.w0 + s.n; w += max)
          atoms.push({ start: w, end: Math.min(s.w0 + s.n, w + max), kind: "words", first: i === a && w === s.w0 });
      }
    }
    a = b;
  }
  const chunks: Chunk[] = [];
  const why = [""];
  for (const at of atoms) {
    const cur = chunks[chunks.length - 1];
    if (cur && at.end - cur.start <= max) {
      cur.end = at.end;
      continue;
    }
    if (cur) {
      const len = at.end - at.start;
      why.push(
        at.kind === "paragraph" ? `The next paragraph (${len} words) would take the chunk past ${max} words, so it starts a new chunk.`
          : at.kind === "sentence" ? (at.first
            ? `This paragraph is longer than ${max} words, so it is broken at sentences.`
            : `The next sentence would take the chunk past ${max} words.`)
            : `A single sentence is longer than ${max} words, so it is cut mid-sentence.`,
      );
    }
    chunks.push({ start: at.start, end: at.end });
  }
  const steps: Step[] = chunks.slice(0, -1).map((c, k) => ({
    cursor: c.end, done: k + 1, kind: "cut" as const, note: `Chunk ${k + 1} ends here. ${why[k + 1]}`,
  }));
  if (chunks.length) steps.push(endStep(chunks));
  return { chunks, why, steps };
}

/** Similarity-threshold cut points, the paper's baseline rule: cut where 1 - cos exceeds the given percentile. */
export function semanticThreshold(sims: (number | null)[], pctSharpest: number): number {
  const vs = sims.slice(1).map((s) => 1 - (s as number)).sort((a, b) => a - b);
  if (!vs.length) return 1;
  return vs[Math.floor((1 - pctSharpest / 100) * (vs.length - 1))];
}

function sentenceTokens(doc: Doc) {
  return doc.sentences.map((s) => s.n);
}

function fromEvents(doc: Doc, chunks: [number, number, number][], events: ReturnType<typeof segmentTraced>["events"],
  noteFor: (e: (typeof events)[number], done: number, chunkStart: number) => string) {
  const ranges = chunks.map(([a, b]) => [a, b] as [number, number]);
  const wc = fromSentenceRanges(doc, ranges);
  let done = 0;
  let chunkStart = 0;
  const steps: Step[] = [];
  const why: string[] = [""];
  for (const e of events) {
    const note = noteFor(e, done, chunkStart);
    if (e.kind === "cut" || e.kind === "forced") {
      done++;
      chunkStart = e.kind === "forced" ? e.c : e.i;
      why.push(note);
    }
    steps.push({ cursor: doc.sentences[e.i].w0, done, kind: e.kind, note, gap: e.kind === "forced" ? e.c : e.i, decided: e.i });
  }
  if (wc.length) steps.push(endStep(wc));
  return { chunks: wc, why, steps };
}

function semantic(doc: Doc, pctSharpest: number): Result | null {
  const sims = doc.sims;
  if (!sims) return null;
  const tau = semanticThreshold(sims, pctSharpest);
  const v = sims.map((s) => (s == null ? null : 1 - s));
  const pi = v.map((x) => (x == null ? null : x > tau ? 1 : 0));
  const tokens = sentenceTokens(doc);
  const { chunks, events } = segmentTraced(tokens, pi,
    { tau_b: 0.5, L_min: 1, L_t: SEMANTIC_CAP, L_max: SEMANTIC_CAP, gamma: 0.5, eta: 0 });
  const r = fromEvents(doc, chunks, events, (e) => {
    const sim = sims[e.i] as number;
    if (e.kind === "forced")
      return `Sentence ${e.i + 1} would take the chunk past ${SEMANTIC_CAP} words, so the chunk is closed before sentence ${e.c + 1}.`;
    return e.kind === "cut"
      ? `Sentences ${e.i} and ${e.i + 1} are only ${pct(sim)} alike, below the cut line of ${pct(1 - tau)}. Cut.`
      : `Sentences ${e.i} and ${e.i + 1} are ${pct(sim)} alike, above the cut line of ${pct(1 - tau)}. Keep going.`;
  });
  return { ...r, signal: { label: "How far the topic jumps between neighbouring sentences (1 − similarity)", values: v,
    threshold: tau, thresholdLabel: `cut line: sharpest ${pctSharpest}% of jumps`, format: (x) => x.toFixed(2) } };
}

export interface StpModel { window: number; weights: PlaygroundData["weights"]; scalers: PlaygroundData["scalers"] }

export function stpParams(tau: number, max: number) {
  return { tau_b: tau, L_min: Math.round(max * 0.2), L_t: Math.round(max * 0.55), L_max: max, gamma: 0.5, eta: 0 };
}

export function stpProbabilities(doc: Doc, m: StpModel) {
  const prof = profileFromSims(doc.sims!, m.window, m.scalers);
  const pi = boundaryProbabilities(prof.v_hat, prof.a_hat, prof.sigma_hat, doc.sentences.map((s) => s.structure), m.weights);
  return { prof, pi };
}

function stp(doc: Doc, tau: number, max: number, m: StpModel): Result | null {
  if (!doc.sims) return null;
  const { prof, pi } = stpProbabilities(doc, m);
  const p = stpParams(tau, max);
  const { chunks, events } = segmentTraced(sentenceTokens(doc), pi, p);
  const prefix = [0];
  for (const s of doc.sentences) prefix.push(prefix[prefix.length - 1] + s.n);
  const r = fromEvents(doc, chunks, events, (e, _done, chunkStart) => {
    const score = (pi[e.i] ?? 0).toFixed(2);
    const why: string[] = [];
    if ((prof.v_hat[e.i] ?? 0) > 1) why.push("a sharp topic jump");
    if ((prof.a_hat[e.i] ?? 0) > 1) why.push("the change is speeding up");
    if (doc.sentences[e.i].structure[0]) why.push("a section heading");
    else if (doc.sentences[e.i].structure[1]) why.push("a new paragraph");
    const because = why.length ? ` (${why.join(", ")})` : "";
    switch (e.kind) {
      case "cut":
        return `Before sentence ${e.i + 1}: cut score ${score}${because} is above ${tau.toFixed(2)}. Cut.`;
      case "short":
        return `Before sentence ${e.i + 1}: cut score ${score} is high, but the chunk has only ${prefix[e.i] - prefix[chunkStart]} words (minimum ${p.L_min}). Keep going.`;
      case "keep":
        return `Before sentence ${e.i + 1}: cut score ${score}${because} is below ${tau.toFixed(2)}. Keep going.`;
      case "forced":
        return `Sentence ${e.i + 1} would take the chunk past ${max} words. STP looks back and cuts at the best earlier gap, before sentence ${e.c + 1}, weighing its score against the target size of ${p.L_t} words (Eq. 7).`;
    }
  });
  return { ...r, signal: { label: "STP cut score π for each gap between sentences (Eq. 6)", values: pi, threshold: tau,
    thresholdLabel: `cut threshold ${tau.toFixed(2)}`, format: (x) => x.toFixed(2) } };
}

export function runTechnique(doc: Doc, t: TechId, s: Settings, m: StpModel): Result | null {
  if (!doc.words.length) return { chunks: [], why: [], steps: [] };
  switch (t) {
    case "fixed": return fixed(doc, s.fixed.size);
    case "overlap": return overlap(doc, s.overlap.size, Math.min(s.overlap.overlap, s.overlap.size - 1));
    case "sentence": return sentences(doc, s.sentence.per);
    case "recursive": return recursive(doc, s.recursive.max);
    case "semantic": return semantic(doc, s.semantic.pct);
    case "stp": return stp(doc, s.stp.tau, s.stp.max, m);
  }
}

export interface Measures {
  count: number;
  mean: number;
  min: number;
  max: number;
  /** sentences that a cut falls inside */
  split: number;
  /** chunks holding sentences from two or more hand-marked topics (null when the text has no marks) */
  mixed: number | null;
  /** hand-marked topic changes that fall exactly on a chunk edge */
  shiftsKept: { kept: number; total: number } | null;
  /** words stored more than once because of overlap */
  repeated: number;
}

export function measure(doc: Doc, chunks: Chunk[]): Measures {
  const sizes = chunks.map((c) => c.end - c.start);
  const sentOf = sentenceOfWord(doc);
  const edges = new Set<number>();
  for (const c of chunks) {
    edges.add(c.start);
    edges.add(c.end);
  }
  const splitSents = new Set<number>();
  for (const b of edges) if (midSentence(sentOf, b)) splitSents.add(sentOf[b]);
  let mixed: number | null = null;
  let shiftsKept: Measures["shiftsKept"] = null;
  if (doc.topics?.length) {
    const starts = doc.topics.map((t) => t.start);
    const topicOf = (sent: number) => starts.filter((s) => s <= sent).length - 1;
    mixed = chunks.filter((c) => topicOf(sentOf[c.start]) !== topicOf(sentOf[c.end - 1])).length;
    const inner = starts.filter((s) => s > 0);
    shiftsKept = { kept: inner.filter((s) => edges.has(doc.sentences[s].w0)).length, total: inner.length };
  }
  const total = sizes.reduce((a, b) => a + b, 0);
  return {
    count: chunks.length,
    mean: total / Math.max(1, chunks.length),
    min: Math.min(...sizes),
    max: Math.max(...sizes),
    split: splitSents.size,
    mixed,
    shiftsKept,
    repeated: total - doc.words.length,
  };
}

export const chunkText = (doc: Doc, c: Chunk) => doc.words.slice(c.start, c.end).join(" ");
