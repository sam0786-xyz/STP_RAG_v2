import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Pilot, PilotRow } from "../lib/types";
import { ARM_COLOR, RECONCILE, STATUS_TONE } from "../lib/content";
import { Disclosure, EASE, PageHead, Segmented, fmt } from "../components/ui";

type DS = "HotpotQA" | "QASPER";
type Metric = "f1" | "em" | "recall" | "mrr" | "latency";

const METRICS: { key: Metric; label: string; field: keyof PilotRow; lowerBetter?: boolean; note: string }[] = [
  { key: "f1", label: "Answer F1", field: "f1_mean", note: "Word overlap between the answer and the reference, from 25 generated answers per dataset." },
  { key: "em", label: "Exact match", field: "em_mean", note: "Share of the 25 answers that match exactly; the number in brackets is the count." },
  { key: "recall", label: "Recall@5", field: "recall_mean", note: "Share of questions whose evidence appears in the top 5 chunks." },
  { key: "mrr", label: "MRR", field: "mrr_mean", note: "How high the first correct chunk ranks (1 means first)." },
  { key: "latency", label: "Search time", field: "latency_mean", lowerBetter: true, note: "Mean vector-search time in milliseconds. Lower is better; it grows with the number of chunks." },
];

const ISSUES = [
  { title: "Only 25 answers were scored", body: "Each dataset had 25 generated answers, so one extra correct answer moves exact match by 0.04. On HotpotQA the context gain in exact match is 3 answers versus 6." },
  { title: "42 of 149 QASPER questions were dropped", body: "Their evidence could not be matched to chunks by exact substring search, so they were left out of the retrieval scores. Long or paraphrased evidence is the most likely to be lost, which may bias the rest." },
  { title: "Methods read different amounts of text", body: "Every method sent its top 3 chunks. Fixed-size chunks are about three times larger, so they sent about 960 tokens against 345 for STP. The Ask a question page shows this on the demo document." },
  { title: "The “velocity-only” baseline was not velocity-only", body: "It kept the heading weight switched on, so it is really velocity plus structure. The labels here are corrected." },
  { title: "Three seeds, but no real uncertainty estimate", body: "Retrieval gave identical numbers for every seed, so the earlier confidence intervals measured nothing. Real intervals need per-question records, which the next run will keep." },
];

export default function ResultsPage({ pilot }: { pilot: Pilot }) {
  const [ds, setDs] = useState<DS>("HotpotQA");
  const [metric, setMetric] = useState<Metric>("f1");
  const [picked, setPicked] = useState<string | null>(null);
  const spec = METRICS.find((m) => m.key === metric)!;
  const rows = pilot.rows.filter((r) => r.dataset === ds);
  const val = (r: PilotRow) => r[spec.field] as number;
  const sorted = [...rows].sort((a, b) => (spec.lowerBetter ? val(a) - val(b) : val(b) - val(a)));
  const max = Math.max(...rows.map(val)) || 1;
  const label = (r: PilotRow) => pilot.arms[r.method].label;
  const detail = rows.find((r) => r.arm === picked) ?? null;

  return (
    <>
      <PageHead title="Pilot results"
        hint={<>switch to <strong>QASPER</strong> and notice that fixed-size chunking comes first there.</>}>
        Numbers from the first, small experiment, exactly as audited. Treat them as a first look; the list
        below explains why they cannot rank the methods yet.
      </PageHead>

      <div className="toolbar">
        <Segmented id="res-ds" label="Dataset" value={ds} onChange={(v) => { setDs(v); setPicked(null); }}
          options={[{ value: "HotpotQA", label: "HotpotQA" }, { value: "QASPER", label: "QASPER" }]} />
        <Segmented id="res-metric" label="Metric" value={metric} onChange={setMetric}
          options={METRICS.map((m) => ({ value: m.key, label: m.label }))} />
      </div>

      <div className="panel panel-pad">
        <p className="small muted" style={{ margin: "0 0 14px" }}>{spec.note} Click a bar for the full row.</p>
        <div className="hbars" role="list">
          {sorted.map((r, i) => (
            <motion.button key={r.arm} layout role="listitem" className={`hbar${picked === r.arm ? " picked" : ""}`}
              onClick={() => setPicked(picked === r.arm ? null : r.arm)} aria-pressed={picked === r.arm}
              transition={{ layout: { duration: 0.28, ease: EASE } }}>
              <span className="hbar-label">
                <span className="swatch" style={{ background: ARM_COLOR[r.arm] }} />{label(r)}
                {i === 0 && <span className="chip chip-plain" style={{ marginLeft: 8 }}>{spec.lowerBetter ? "fastest" : "highest"}</span>}
              </span>
              <span className="hbar-track">
                <motion.span className="hbar-fill" style={{ background: ARM_COLOR[r.arm] }} initial={false}
                  animate={{ width: `${(val(r) / max) * 100}%` }} transition={{ duration: 0.3, ease: EASE }} />
              </span>
              <span className="hbar-value">
                {metric === "latency" ? `${fmt(val(r), 2)} ms` : fmt(val(r))}
                {metric === "em" && <span className="muted"> ({r.em_count})</span>}
              </span>
            </motion.button>
          ))}
        </div>
        <AnimatePresence initial={false}>
          {detail && (
            <motion.div className="row-detail" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: EASE }}>
              <div className="row-detail-inner">
                <h3>{label(detail)}, {ds}</h3>
                {detail.arm === "vel_struct" && <p className="small muted" style={{ margin: "2px 0 0" }}>Called “velocity-only” in the pilot code; its heading weight was still on.</p>}
                <div className="detail-grid">
                  <span>Recall@5 <strong>{fmt(detail.recall_mean)}</strong></span>
                  <span>MRR <strong>{fmt(detail.mrr_mean)}</strong></span>
                  <span>Exact match <strong>{fmt(detail.em_mean)}</strong> ({detail.em_count} of 25)</span>
                  <span>F1 <strong>{fmt(detail.f1_mean)}</strong></span>
                  <span>Chunks per document <strong>{fmt(detail.chunks_mean, 1)}</strong></span>
                  <span>Search time <strong>{fmt(detail.latency_mean, 2)} ms</strong></span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        Retrieval scores use {pilot.retrieval_queries[ds]} questions{ds === "QASPER" ? " (42 were dropped)" : ""}; answer scores use 25.
      </p>

      <section>
        <h2>Why these numbers are not final</h2>
        <p className="lede">Five problems found by the audit. The next run is designed to remove each one.</p>
        <div className="panel">
          {ISSUES.map((it) => (
            <Disclosure key={it.title} title={it.title}><p style={{ margin: 0 }}>{it.body}</p></Disclosure>
          ))}
          <Disclosure title="Component-by-component audit" meta={`${RECONCILE.length} items`}>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Component</th><th>What the paper specifies</th><th>What the pilot did</th><th>Status</th></tr></thead>
                <tbody>
                  {RECONCILE.map((r) => (
                    <tr key={r.component}>
                      <td style={{ fontWeight: 500 }}>{r.component}</td>
                      <td>{r.reference}</td>
                      <td style={{ color: "var(--ink-2)" }}>{r.pilot}</td>
                      <td><span className={`chip chip-${STATUS_TONE[r.status]}`}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Disclosure>
        </div>
      </section>
    </>
  );
}
