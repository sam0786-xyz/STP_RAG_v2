/**
 * A document as the playground sees it: sentences (the units STP and the semantic method decide
 * between) laid over a flat word array (the unit sizes are counted in, and where fixed-size cuts land).
 */
import type { Demo } from "./types";

export interface Sentence {
  text: string;
  /** index of the sentence's first word in Doc.words */
  w0: number;
  /** number of words */
  n: number;
  /** first sentence of a paragraph (sentence 0 included) */
  paraStart: boolean;
  /** section heading shown before this sentence, if any */
  heading?: string;
  /** structure flags for Eq. 6: heading, paragraph, list item, equation, table */
  structure: number[];
}

export interface Topic { label: string; start: number }
export interface Question { q: string; gold: number[] }

export interface Doc {
  id: string;
  title: string;
  kind: string;
  blurb?: string;
  sentences: Sentence[];
  words: string[];
  /** cosine similarity between sentence i-1 and i (index 0 is null); null when not embedded yet */
  sims: (number | null)[] | null;
  topics?: Topic[];
  questions?: Question[];
}

export interface Sample {
  id: string;
  title: string;
  kind: string;
  blurb: string;
  paragraphs: string[][];
  sims: (number | null)[];
  topics: Topic[];
  questions: Question[];
}

export interface PlaygroundData {
  encoder: { name: string; runtime: string; browser: string };
  window: number;
  weights: Demo["weights"];
  scalers: Record<"v" | "a" | "sigma", { center: number; scale: number; method: string }>;
  reference_corpus: string;
  samples: Sample[];
  parity: { sample: string; params: Demo["params"]; pi: (number | null)[]; chunks: [number, number, number][] };
}

const splitWords = (t: string) => t.split(/\s+/).filter(Boolean);

function build(
  meta: Omit<Doc, "sentences" | "words" | "sims">,
  units: { text: string; paraStart: boolean; heading?: string; structure?: number[] }[],
  sims: (number | null)[] | null,
): Doc {
  const words: string[] = [];
  const sentences: Sentence[] = units.map((u, i) => {
    const ws = splitWords(u.text);
    const s: Sentence = {
      text: u.text,
      w0: words.length,
      n: ws.length,
      paraStart: u.paraStart,
      heading: u.heading,
      structure: u.structure ?? [0, u.paraStart && i > 0 ? 1 : 0, 0, 0, 0],
    };
    words.push(...ws);
    return s;
  });
  return { ...meta, sentences, words, sims };
}

export function fromSample(s: Sample): Doc {
  const units = s.paragraphs.flatMap((p) => p.map((text, k) => ({ text, paraStart: k === 0 })));
  return build({ id: s.id, title: s.title, kind: s.kind, blurb: s.blurb, topics: s.topics, questions: s.questions },
    units, s.sims);
}

/** The paper's Sections 1-3 from demo.json; similarities come from its stored velocities. */
export function fromPaper(demo: Demo): Doc {
  const units = demo.units.map((u, i) => ({
    text: u.text,
    paraStart: u.para,
    heading: u.heading ? u.subsection || u.section : undefined,
    structure: demo.signals.structure[i],
  }));
  const sims = demo.signals.v.map((v) => (v == null ? null : 1 - v));
  const questions = demo.questions.map((q) => ({ q: q.question, gold: q.gold_units }));
  return build({ id: "paper", title: "The paper, Sections 1–3", kind: "Research paper", questions }, units, sims);
}

const ABBREV = /\b(e\.g|i\.e|et al|etc|Eq|Eqs|Fig|Sec|vs|cf|Dr|Mr|Mrs|Ms|Prof|St|No|approx|U\.S|a\.m|p\.m)\.$/i;

/** Sentence splitter for pasted text: split after . ? ! when the next word starts a sentence. */
export function splitSentences(par: string): string[] {
  const out: string[] = [];
  let buf = "";
  for (const piece of par.split(/(?<=[.?!][”"')\]]?)\s+(?=[A-Z0-9“"‘'(\[])/)) {
    buf = buf ? `${buf} ${piece}` : piece;
    if (!ABBREV.test(buf) && !/\b[A-Z]\.$/.test(buf)) {
      out.push(buf);
      buf = "";
    }
  }
  if (buf) out.push(buf);
  return out;
}

export const MAX_WORDS = 5000;

export function fromText(text: string): Doc {
  const paras = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const units = paras.flatMap((p) => splitSentences(p).map((t, k) => ({ text: t, paraStart: k === 0 })));
  return build({ id: "custom", title: "Your text", kind: "Pasted text" }, units, null);
}

/** Index of the sentence that word w belongs to. */
export function sentenceOfWord(doc: Doc): Int32Array {
  const out = new Int32Array(doc.words.length);
  doc.sentences.forEach((s, i) => out.fill(i, s.w0, s.w0 + s.n));
  return out;
}

export function sentenceSims(emb: number[][]): (number | null)[] {
  return emb.map((e, i) => (i === 0 ? null : e.reduce((a, x, k) => a + x * emb[i - 1][k], 0)));
}
