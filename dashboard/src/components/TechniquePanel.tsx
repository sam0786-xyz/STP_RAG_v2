import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Doc } from "../lib/doc";
import type { Settings, StpModel, TechId } from "../lib/chunkers";
import { SEMANTIC_CAP, TECHS, measure, runTechnique } from "../lib/chunkers";
import { loadEncoder, useEncoder } from "../lib/encoder";
import ChunkedText, { ChunkRibbon } from "./ChunkedText";
import SignalStrip from "./SignalStrip";
import { EASE, Slider } from "./ui";

export function TechTabs({ value, onChange, id }: { value: TechId; onChange: (t: TechId) => void; id: string }) {
  return (
    <div className="tech-tabs" role="tablist" aria-label="Chunking technique">
      {TECHS.map((t) => (
        <button key={t.id} role="tab" aria-selected={t.id === value} className="tech-tab" onClick={() => onChange(t.id)}>
          {t.id === value && <motion.span layoutId={`tech-${id}`} className="tech-tab-bg" transition={{ duration: 0.2, ease: EASE }} />}
          <span className="tech-tab-name">{t.name}</span>
          <span className="tech-tab-sub">{t.needsModel ? "by meaning" : "by size or layout"}</span>
        </button>
      ))}
    </div>
  );
}

export function TechSelect({ value, onChange }: { value: TechId; onChange: (t: TechId) => void }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value as TechId)} aria-label="Chunking technique">
      {TECHS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );
}

const mb = (b: number) => `${(b / 1e6).toFixed(0)} MB`;

/** Explains and loads the in-browser embedding model. */
export function ModelGate({ why }: { why: string }) {
  const enc = useEncoder();
  return (
    <div className="gate">
      <div>
        <strong>This needs the embedding model.</strong> {why}
      </div>
      {enc.status === "idle" && (
        <div className="gate-row">
          <button className="btn btn-primary" onClick={() => loadEncoder().catch(() => undefined)}>Load the model (about 65 MB, once)</button>
          <span className="small muted">BAAI/bge-small-en-v1.5 runs inside your browser. Your text is not sent anywhere.</span>
        </div>
      )}
      {enc.status === "loading" && (
        <div className="gate-row" aria-live="polite">
          <div className="meter gate-meter"><motion.div className="meter-fill" style={{ background: "var(--accent)" }} initial={false}
            animate={{ width: enc.total ? `${(enc.loaded / enc.total) * 100}%` : "6%" }} /></div>
          <span className="small muted">{enc.total ? `${mb(enc.loaded)} of ${mb(enc.total)}` : "Starting…"}</span>
        </div>
      )}
      {enc.status === "ready" && <div className="small muted">Model ready. Embedding the sentences…</div>}
      {enc.status === "error" && (
        <div className="gate-row">
          <span className="chip chip-bad">Could not load</span>
          <span className="small">{enc.message}. Check the connection, or run <code>node scripts/fetch_model.mjs</code> once to keep a local copy.</span>
          <button className="btn btn-small" onClick={() => loadEncoder().catch(() => undefined)}>Try again</button>
        </div>
      )}
    </div>
  );
}

function Controls({ tech, s, set }: { tech: TechId; s: Settings; set: (s: Settings) => void }) {
  const words = (v: number) => `${v} words`;
  switch (tech) {
    case "fixed":
      return <Slider label="Chunk size" value={s.fixed.size} min={15} max={150} step={5} format={words}
        onChange={(v) => set({ ...s, fixed: { size: v } })} help="Every chunk gets exactly this many words" />;
    case "overlap":
      return (
        <>
          <Slider label="Chunk size" value={s.overlap.size} min={15} max={150} step={5} format={words}
            onChange={(v) => set({ ...s, overlap: { size: v, overlap: Math.min(s.overlap.overlap, Math.floor(v / 2)) } })} />
          <Slider label="Overlap" value={s.overlap.overlap} min={0} max={Math.floor(s.overlap.size / 2)} step={1} format={words}
            onChange={(v) => set({ ...s, overlap: { ...s.overlap, overlap: v } })} help="Words repeated at the start of the next chunk" />
        </>
      );
    case "sentence":
      return <Slider label="Sentences per chunk" value={s.sentence.per} min={1} max={8} step={1}
        onChange={(v) => set({ ...s, sentence: { per: v } })} help="Whole sentences, never split" />;
    case "recursive":
      return <Slider label="Largest chunk allowed" value={s.recursive.max} min={20} max={200} step={5} format={words}
        onChange={(v) => set({ ...s, recursive: { max: v } })} help="Paragraphs that fit stay whole" />;
    case "semantic":
      return <Slider label="Cut at the sharpest jumps" value={s.semantic.pct} min={5} max={50} step={1} format={(v) => `${v}% of gaps`}
        onChange={(v) => set({ ...s, semantic: { pct: v } })} help={`The paper's baseline uses 15%. Chunks never pass ${SEMANTIC_CAP} words.`} />;
    case "stp":
      return (
        <>
          <Slider label="Cut threshold" value={s.stp.tau} min={0.1} max={0.95} step={0.01} format={(v) => v.toFixed(2)}
            onChange={(v) => set({ ...s, stp: { ...s.stp, tau: v } })} help="Lower means more cuts" />
          <Slider label="Largest chunk allowed" value={s.stp.max} min={40} max={200} step={5} format={words}
            onChange={(v) => set({ ...s, stp: { ...s.stp, max: v } })}
            help={`Target ${Math.round(s.stp.max * 0.55)}, minimum ${Math.round(s.stp.max * 0.2)} words`} />
        </>
      );
  }
}

export default function TechniquePanel({ doc, tech, onTech, settings, onSettings, model, showTopics, autoplay, compact }: {
  doc: Doc;
  tech: TechId;
  onTech?: (t: TechId) => void;
  settings: Settings;
  onSettings: (s: Settings) => void;
  model: StpModel;
  showTopics: boolean;
  autoplay?: boolean;
  compact?: boolean;
}) {
  const meta = TECHS.find((t) => t.id === tech)!;
  const result = useMemo(() => runTechnique(doc, tech, settings, model), [doc, tech, settings, model]);
  const [stepIdx, setStepIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [hoverGap, setHoverGap] = useState<number | null>(null);
  const started = useRef(false);

  // a new chunking invalidates the replay and the selection
  useEffect(() => {
    setStepIdx(null);
    setPlaying(false);
    setSelected(null);
  }, [result]);

  useEffect(() => {
    if (autoplay && result && !started.current) {
      started.current = true;
      setStepIdx(0);
      setPlaying(true);
    }
  }, [autoplay, result]);

  useEffect(() => {
    if (!playing || !result) return;
    const id = window.setTimeout(() => {
      setStepIdx((k) => {
        const next = k === null ? 0 : k + 1;
        if (next >= result.steps.length - 1) setPlaying(false);
        return Math.min(next, result.steps.length - 1);
      });
    }, stepIdx === null ? 0 : 1400);
    return () => window.clearTimeout(id);
  }, [playing, stepIdx, result]);

  const step = result && stepIdx !== null ? result.steps[stepIdx] : null;
  const m = result ? measure(doc, result.chunks) : null;

  const play = () => {
    if (!result) return;
    if (playing) return setPlaying(false);
    if (stepIdx === null || stepIdx >= result.steps.length - 1) setStepIdx(0);
    setPlaying(true);
  };

  return (
    <section className={`panel tpanel${compact ? " tpanel-compact" : ""}`} aria-label={meta.name}>
      <header className="tpanel-head">
        <div className="tpanel-title">
          {onTech ? <TechSelect value={tech} onChange={onTech} /> : <h2>{meta.name}</h2>}
          <p className="small">{meta.how}</p>
        </div>
        <div className="tpanel-controls"><Controls tech={tech} s={settings} set={onSettings} /></div>
      </header>

      {!result ? (
        <div className="tpanel-body">
          <ModelGate why="This technique compares the meaning of neighbouring sentences, so each sentence has to be embedded first. The sample texts come with this done; your own text needs the model." />
        </div>
      ) : (
        <div className="tpanel-body">
          <div className="playbar">
            <button className="btn btn-primary btn-small play-btn" onClick={play} aria-label={playing ? "Pause" : "Play"}>
              {playing ? "Pause" : stepIdx === null ? "▶ Play" : stepIdx >= result.steps.length - 1 ? "↺ Replay" : "▶ Resume"}
            </button>
            <button className="btn btn-small" aria-label="Step back" disabled={!stepIdx}
              onClick={() => { setPlaying(false); setStepIdx((k) => Math.max(0, (k ?? 0) - 1)); }}>‹</button>
            <button className="btn btn-small" aria-label="Step forward" disabled={stepIdx !== null && stepIdx >= result.steps.length - 1}
              onClick={() => { setPlaying(false); setStepIdx((k) => (k === null ? 0 : Math.min(result.steps.length - 1, k + 1))); }}>›</button>
            {stepIdx !== null && (
              <button className="btn btn-small" onClick={() => { setPlaying(false); setStepIdx(null); }}>Show result</button>
            )}
            <div className="narration" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={stepIdx ?? "all"} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: EASE }}>
                  {step ? (
                    <><span className={`step-kind step-${step.kind}`}>{stepLabel(step.kind)}</span> <span className="muted small">Step {stepIdx! + 1} of {result.steps.length}.</span> {step.note}</>
                  ) : (
                    <span className="muted">Press Play to watch the technique read the text and decide where each chunk ends.</span>
                  )}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          <ChunkRibbon result={result} step={step} selected={selected} onSelect={setSelected} />

          <ChunkedText doc={doc} result={result} step={step} selected={selected} onSelect={setSelected}
            hoverGap={hoverGap} onHoverSentence={(s) => setHoverGap(s)} showTopics={showTopics} />

          {selected !== null && result.chunks[selected] && (
            <div className="small sel-note">
              <strong>Chunk {selected + 1}</strong>, {result.chunks[selected].end - result.chunks[selected].start} words.{" "}
              {selected === 0 ? "The first chunk." : result.why[selected]}{" "}
              <button className="linkish" onClick={() => setSelected(null)}>Clear</button>
            </div>
          )}

          {result.signal && (
            <SignalStrip result={result} step={step} hoverGap={hoverGap} onHoverGap={setHoverGap} sentences={doc.sentences.length} />
          )}

          {m && (
            <div className="measures">
              <Measure value={m.count} label="chunks" />
              <Measure value={`${Math.round(m.mean)}`} label={`words on average (${m.min}–${m.max})`} />
              <Measure value={m.split} label={m.split === 1 ? "sentence cut in half" : "sentences cut in half"} bad={m.split > 0} />
              {m.repeated > 0 && <Measure value={m.repeated} label="words stored twice" />}
              {m.shiftsKept && <Measure value={`${m.shiftsKept.kept} of ${m.shiftsKept.total}`} label="topic changes on a chunk edge" good={m.shiftsKept.kept === m.shiftsKept.total} />}
              {m.mixed !== null && <Measure value={m.mixed} label={m.mixed === 1 ? "chunk mixes two topics" : "chunks mix two topics"} bad={m.mixed > 0} />}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function stepLabel(k: string) {
  return { cut: "Cut", keep: "No cut", short: "Too short", forced: "Size limit", end: "Done" }[k] ?? k;
}

function Measure({ value, label, bad, good }: { value: React.ReactNode; label: string; bad?: boolean; good?: boolean }) {
  return (
    <div className={`measure${bad ? " measure-bad" : ""}${good ? " measure-good" : ""}`}>
      <span className="measure-value">{value}</span>
      <span className="measure-label">{label}</span>
    </div>
  );
}
