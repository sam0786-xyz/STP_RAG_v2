import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PlaygroundData } from "./doc";
import { fromSample, fromText, splitSentences } from "./doc";
import type { TechId } from "./chunkers";
import { DEFAULTS, TECHS, measure, runTechnique, semanticThreshold, stpProbabilities } from "./chunkers";
import { segment } from "./stp";

const data: PlaygroundData = JSON.parse(readFileSync(new URL("../../public/data/playground.json", import.meta.url), "utf8"));
const model = { window: data.window, weights: data.weights, scalers: data.scalers };
const docs = data.samples.map(fromSample);

describe("playground STP matches stp_eval (Python)", () => {
  const doc = docs.find((d) => d.id === data.parity.sample)!;
  const { pi } = stpProbabilities(doc, model);

  it("reproduces boundary probabilities from the similarities", () => {
    pi.forEach((p, i) => {
      if (p === null) expect(data.parity.pi[i]).toBeNull();
      else expect(Math.abs(p - (data.parity.pi[i] as number))).toBeLessThan(1e-4);
    });
  });

  it("reproduces the STP chunks in words", () => {
    expect(segment(doc.sentences.map((s) => s.n), pi, data.parity.params)).toEqual(data.parity.chunks);
  });
});

describe("every technique on every sample", () => {
  for (const doc of docs) {
    for (const t of TECHS.map((x) => x.id as TechId)) {
      it(`${t} on ${doc.id} covers the text in order`, () => {
        const r = runTechnique(doc, t, DEFAULTS, model)!;
        expect(r.chunks[0].start).toBe(0);
        expect(r.chunks[r.chunks.length - 1].end).toBe(doc.words.length);
        r.chunks.forEach((c, k) => {
          expect(c.end).toBeGreaterThan(c.start);
          if (k > 0) {
            if (t === "overlap") expect(c.start).toBeLessThan(r.chunks[k - 1].end);
            else expect(c.start).toBe(r.chunks[k - 1].end);
          }
        });
        expect(r.why.length).toBe(r.chunks.length);
        const last = r.steps[r.steps.length - 1];
        expect(last.kind).toBe("end");
        expect(last.done).toBe(r.chunks.length);
        // the replay only ever moves forward
        r.steps.forEach((s, k) => k > 0 && expect(s.done).toBeGreaterThanOrEqual(r.steps[k - 1].done));
      });
    }
  }
});

describe("technique rules", () => {
  const doc = docs[0];

  it("fixed size makes equal chunks except the last", () => {
    const r = runTechnique(doc, "fixed", { ...DEFAULTS, fixed: { size: 40 } }, model)!;
    r.chunks.slice(0, -1).forEach((c) => expect(c.end - c.start).toBe(40));
  });

  it("overlap repeats exactly the overlap between neighbours", () => {
    const r = runTechnique(doc, "overlap", { ...DEFAULTS, overlap: { size: 40, overlap: 10 } }, model)!;
    for (let k = 1; k < r.chunks.length; k++) expect(r.chunks[k - 1].end - r.chunks[k].start).toBeLessThanOrEqual(10);
    expect(measure(doc, r.chunks).repeated).toBeGreaterThan(0);
  });

  it("sentence, recursive, semantic and STP never cut inside a sentence", () => {
    for (const t of ["sentence", "recursive", "semantic", "stp"] as TechId[]) {
      const r = runTechnique(doc, t, DEFAULTS, model)!;
      expect(measure(doc, r.chunks).split).toBe(0);
    }
  });

  it("recursive keeps chunks within the limit and whole paragraphs when they fit", () => {
    const r = runTechnique(doc, "recursive", { ...DEFAULTS, recursive: { max: 80 } }, model)!;
    r.chunks.forEach((c) => expect(c.end - c.start).toBeLessThanOrEqual(80));
    const big = runTechnique(doc, "recursive", { ...DEFAULTS, recursive: { max: 200 } }, model)!;
    const paraStarts = new Set(doc.sentences.filter((s) => s.paraStart).map((s) => s.w0));
    big.chunks.forEach((c) => expect(paraStarts.has(c.start)).toBe(true));
  });

  it("semantic threshold follows the paper's percentile rule", () => {
    const sims = [null, 0.9, 0.8, 0.7, 0.6, 0.5];
    // distances 0.1..0.5; 85th percentile index floor(0.85 * 4) = 3 -> 0.4
    expect(semanticThreshold(sims, 15)).toBeCloseTo(0.4);
  });

  it("STP without similarities waits for the model", () => {
    expect(runTechnique(fromText("One sentence here. Another one there."), "stp", DEFAULTS, model)).toBeNull();
  });
});

describe("text parsing", () => {
  it("splits sentences but not abbreviations", () => {
    expect(splitSentences("See e.g. the guide. Dr. Rao agreed! Was it 5 p.m. then? Yes.")).toEqual([
      "See e.g. the guide.", "Dr. Rao agreed!", "Was it 5 p.m. then?", "Yes.",
    ]);
  });

  it("uses blank lines as paragraph breaks", () => {
    const d = fromText("First one. Second one.\n\nThird one.\nStill third paragraph.");
    expect(d.sentences.map((s) => s.paraStart)).toEqual([true, false, true, false]);
    expect(d.sentences[2].structure[1]).toBe(1);
    expect(d.sentences[0].structure[1]).toBe(0);
  });

  it("counts hand-marked topic changes", () => {
    const doc = docs[0];
    const r = runTechnique(doc, "sentence", { ...DEFAULTS, sentence: { per: 1 } }, model)!;
    const m = measure(doc, r.chunks);
    expect(m.shiftsKept).toEqual({ kept: doc.topics!.length - 1, total: doc.topics!.length - 1 });
    expect(m.mixed).toBe(0);
  });
});
