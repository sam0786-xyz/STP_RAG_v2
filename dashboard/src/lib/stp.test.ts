import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { boundaryProbabilities, segment } from "./stp";
import type { Demo } from "./types";

const demo: Demo = JSON.parse(readFileSync(new URL("../../public/data/demo.json", import.meta.url), "utf8"));

describe("browser port matches stp_eval (Python)", () => {
  const s = demo.signals;
  const pi = boundaryProbabilities(s.v_hat, s.a_hat, s.sigma_hat, s.structure, demo.weights);

  it("reproduces boundary probabilities to rounding precision", () => {
    pi.forEach((p, i) => {
      if (p === null) expect(s.pi[i]).toBeNull();
      else expect(Math.abs(p - (s.pi[i] as number))).toBeLessThan(2e-4);
    });
  });

  it("reproduces the STP chunking exactly", () => {
    const tokens = demo.units.map((u) => u.tokens);
    expect(segment(tokens, s.pi, demo.params)).toEqual(demo.chunkings.stp);
  });

  it("forced cut follows Eq. 7 on the hand-traced example", () => {
    const chunks = segment(Array(10).fill(10), [null, ...Array(9).fill(0.1)],
      { tau_b: 0.5, L_min: 20, L_t: 30, L_max: 40, gamma: 0.5, eta: 0 });
    expect(chunks.map((c) => [c[0], c[1]])).toEqual([[0, 2], [3, 5], [6, 9]]);
  });
});
