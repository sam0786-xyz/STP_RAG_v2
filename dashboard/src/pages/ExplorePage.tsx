import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Demo, SegmentParams, Weights } from "../lib/types";
import { boundaryProbabilities, chunkStats, segment } from "../lib/stp";
import { METHOD_COLOR, METHOD_LABEL } from "../lib/content";
import SignalScope from "../components/SignalScope";
import { Disclosure, EASE, PageHead, Segmented, Slider, fmt } from "../components/ui";

type Preset = "large" | "balanced" | "small" | "custom";

const PRESETS: Record<Exclude<Preset, "custom">, SegmentParams> = {
  large: { tau_b: 0.7, L_min: 60, L_t: 160, L_max: 300, gamma: 0.5, eta: 0 },
  balanced: { tau_b: 0.5, L_min: 40, L_t: 110, L_max: 200, gamma: 0.5, eta: 0 },
  small: { tau_b: 0.35, L_min: 20, L_t: 60, L_max: 120, gamma: 0.5, eta: 0 },
};

export default function ExplorePage({ demo }: { demo: Demo }) {
  const [w, setW] = useState<Weights>(demo.weights);
  const [p, setP] = useState<SegmentParams>(demo.params);
  const [preset, setPreset] = useState<Preset>("balanced");
  const [sel, setSel] = useState(0);
  const s = demo.signals;
  const tokens = useMemo(() => demo.units.map((u) => u.tokens), [demo]);
  const headings = useMemo(() => demo.units.map((u, i) => (u.heading ? i : -1)).filter((i) => i >= 0), [demo]);

  const pi = useMemo(() => boundaryProbabilities(s.v_hat, s.a_hat, s.sigma_hat, s.structure, w), [s, w]);
  const stp = useMemo(() => segment(tokens, pi, p, s.sigma_hat), [tokens, pi, p, s]);
  const chunks = { fixed: demo.chunkings.fixed, similarity: demo.chunkings.similarity, stp };
  const selected = Math.min(sel, stp.length - 1);

  // keep the selection valid when the chunking changes; arrow keys step through chunks
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).closest("svg")) return;
      if (e.key === "ArrowRight") setSel((k) => Math.min(stp.length - 1, k + 1));
      if (e.key === "ArrowLeft") setSel((k) => Math.max(0, k - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stp.length]);

  const applyPreset = (v: Preset) => {
    setPreset(v);
    if (v !== "custom") setP(PRESETS[v]);
  };
  const setMax = (L_max: number) => {
    setPreset("custom");
    setP({ ...p, L_max, L_t: Math.round(L_max * 0.55), L_min: Math.round(L_max * 0.2) });
  };

  const [cs, ce, ctok] = stp[selected];
  const unitsSel = demo.units.slice(cs, ce + 1);
  const stats = {
    fixed: chunkStats(demo.chunkings.fixed, headings),
    similarity: chunkStats(demo.chunkings.similarity, headings),
    stp: chunkStats(stp, headings),
  };

  return (
    <>
      <PageHead
        title="How STP works"
        hint={<>pick <strong>More, smaller chunks</strong>, then click any green block to read it.</>}>
        The Playground shows where STP cuts. This page shows why: the four signals it reads at every sentence of a
        longer document, the paper's own Sections 1–3, with sizes counted in tokens as in the paper.
      </PageHead>

      <div className="toolbar">
        <Segmented id="preset" label="Chunk size preset" value={preset} onChange={applyPreset}
          options={[
            { value: "large", label: "Fewer, larger chunks" },
            { value: "balanced", label: "Balanced" },
            { value: "small", label: "More, smaller chunks" },
            ...(preset === "custom" ? [{ value: "custom" as Preset, label: "Custom" }] : []),
          ]} />
      </div>

      <div className="panel">
        <div className="scope">
          <SignalScope demo={demo} pi={pi} tauB={p.tau_b} chunks={chunks} selected={selected} onSelect={setSel} />
        </div>
        <div className="scope-controls scope-controls-2">
          <Slider label="Cut threshold" value={p.tau_b} min={0.1} max={0.95} step={0.01}
            onChange={(v) => { setPreset("custom"); setP({ ...p, tau_b: v }); }} format={(v) => v.toFixed(2)}
            help="Lower cuts more often" />
          <Slider label="Largest chunk allowed" value={p.L_max} min={80} max={400} step={10} onChange={setMax}
            format={(v) => `${v} tokens`} help="A chunk is forced to end before this size" />
        </div>
      </div>

      <div className="explore-grid">
        <section className="panel reader" aria-live="polite">
          <div className="reader-head">
            <div>
              <h2>Chunk {selected + 1} of {stp.length}</h2>
              <div className="muted small">
                {ctok} tokens, {unitsSel.length} sentence{unitsSel.length > 1 ? "s" : ""}, in {unitsSel[0].subsection || unitsSel[0].section}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-small" disabled={selected === 0} onClick={() => setSel(selected - 1)} aria-label="Previous chunk">Previous</button>
              <button className="btn btn-small" disabled={selected === stp.length - 1} onClick={() => setSel(selected + 1)} aria-label="Next chunk">Next</button>
            </div>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${cs}-${ce}`} className="reader-text" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.16, ease: EASE }}>
              {unitsSel.map((u, j) => (
                <span key={j}>{u.text} </span>
              ))}
            </motion.div>
          </AnimatePresence>
          <p className="small muted" style={{ margin: 0 }}>
            {cs === 0 ? "This is the first chunk." : unitsSel[0].heading
              ? "It starts at a section heading, a boundary STP is meant to respect."
              : `It starts where the cut score reached ${fmt(pi[cs], 2)}.`}
          </p>
        </section>

        <section className="compare">
          <h2>Three ways to cut the same text</h2>
          {(["fixed", "similarity", "stp"] as const).map((m) => (
            <div className="compare-row" key={m}>
              <span className="swatch" style={{ background: METHOD_COLOR[m] }} />
              <span className="compare-name">{METHOD_LABEL[m]}</span>
              <span className="compare-val"><strong>{stats[m].count}</strong> chunks</span>
              <span className="compare-val">~{stats[m].meanTokens.toFixed(0)} tokens each</span>
              <span className="compare-val">{stats[m].headingCuts} of {stats[m].headings} sections kept apart</span>
            </div>
          ))}
          <p className="small muted" style={{ margin: "10px 0 0" }}>
            Fixed-size cuts every ~{demo.fixed_L} tokens regardless of meaning. Similarity cuts where neighbouring
            sentences differ. STP also weighs acceleration, volatility and headings.
          </p>
        </section>
      </div>

      <div style={{ marginTop: 28 }}>
        <Disclosure title="Fine-tune the signals" meta="For readers of Section 3">
          <p className="small muted" style={{ marginTop: 0 }}>
            These are the weights of Eq. 6. They are set by hand for this demo; the paper calibrates them on
            development data.
          </p>
          <div className="scope-controls" style={{ border: 0, padding: 0 }}>
            <Slider label={<>Velocity w<sub>v</sub></>} value={w.w_v} min={0} max={3} step={0.1} onChange={(v) => setW({ ...w, w_v: v })} format={(v) => v.toFixed(1)} />
            <Slider label={<>Acceleration w<sub>a</sub></>} value={w.w_a} min={0} max={3} step={0.1} onChange={(v) => setW({ ...w, w_a: v })} format={(v) => v.toFixed(1)} />
            <Slider label={<>Volatility w<sub>σ</sub></>} value={w.w_sigma} min={0} max={3} step={0.1} onChange={(v) => setW({ ...w, w_sigma: v })} format={(v) => v.toFixed(1)} />
            <Slider label={<>Headings w<sub>s</sub></>} value={w.w_s[0]} min={0} max={6} step={0.1}
              onChange={(v) => setW({ ...w, w_s: [v, ...w.w_s.slice(1)] })} format={(v) => v.toFixed(1)} />
          </div>
          <button className="btn btn-small" style={{ marginTop: 14 }}
            onClick={() => { setW(demo.weights); applyPreset("balanced"); }}>Reset everything</button>
        </Disclosure>
      </div>
    </>
  );
}
