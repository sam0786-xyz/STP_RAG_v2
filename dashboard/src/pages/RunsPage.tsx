import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { scaleLinear } from "d3-scale";
import type { RunBundle, RunQuery } from "../lib/types";
import { Drawer, Segmented, fmt, useWidth } from "../components/ui";

const EASE = [0.23, 1, 0.32, 1] as const;

function validate(x: unknown): RunBundle {
  const b = x as RunBundle;
  if (!b || b.kind !== "stp-eval-run" || typeof b.datasets !== "object") {
    throw new Error("This file is not a run bundle from stp_eval.report (expected \"kind\": \"stp-eval-run\").");
  }
  if (Object.keys(b.datasets).length === 0) throw new Error("The bundle contains no datasets.");
  return b;
}

export default function RunsPage({ bundle, onBundle }: { bundle: RunBundle | null; onBundle: (b: RunBundle | null) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const readFile = (f: File) => {
    setError(null);
    f.text()
      .then((t) => onBundle(validate(JSON.parse(t))))
      .catch((e: Error) => setError(e instanceof SyntaxError ? `${f.name} is not valid JSON.` : e.message));
  };
  const loadSynthetic = () => {
    setError(null);
    fetch("./data/synthetic_run.json")
      .then((r) => r.json())
      .then((j) => onBundle(validate(j)))
      .catch((e: Error) => setError(e.message));
  };

  if (!bundle) {
    return (
      <>
        <div className="drop" data-over={over}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}>
          <h2>Load the results</h2>
          <p className="muted" style={{ margin: 0 }}>
            No real run exists yet. When it does, drop its <code>run_bundle.json</code> here or choose it from disk.
            The file stays in your browser; nothing is uploaded.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => input.current?.click()}>Choose file</button>
            <button className="btn" onClick={loadSynthetic}>Try with synthetic test data</button>
          </div>
          <input ref={input} type="file" accept=".json,application/json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />
          {error && <div className="note" role="alert" style={{ width: "100%" }}>{error}</div>}
          <div style={{ width: "100%" }}>
            <p className="small muted" style={{ margin: "8px 0 6px" }}>Build a bundle from per-query JSONL files with the harness:</p>
            <div className="code">{`cd stp_eval_harness
python3 -m stp_eval.report runs/ --baseline fixed_matched \\
    --metrics recall@5 mrr@10 em f1 --cluster QASPER --out run_bundle.json`}</div>
          </div>
        </div>
      </>
    );
  }
  return <RunView bundle={bundle} onClear={() => onBundle(null)} />;
}

function RunView({ bundle, onClear }: { bundle: RunBundle; onClear: () => void }) {
  const names = Object.keys(bundle.datasets);
  const [ds, setDs] = useState(names[0]);
  const data = bundle.datasets[ds];
  const metrics = Object.keys(data.comparisons);
  const [metric, setMetric] = useState(metrics.includes("f1") ? "f1" : metrics[0]);
  const [arm, setArm] = useState(() => Object.keys(data.comparisons[metric] ?? {})[0] ?? "");
  const [filter, setFilter] = useState<"all" | "wins" | "losses" | "ties">("all");
  const [open, setOpen] = useState<RunQuery | null>(null);
  const comps = data.comparisons[metric] ?? {};
  const armNames = Object.keys(comps);
  const activeArm = armNames.includes(arm) ? arm : armNames[0];

  const rows = useMemo(() => {
    return data.queries
      .map((q) => {
        const a = q.arms[activeArm]?.metrics[metric];
        const b = q.arms[data.baseline]?.metrics[metric];
        return { q, d: a != null && b != null ? a - b : null };
      })
      .filter((r) => r.d != null)
      .filter((r) => filter === "all" || (filter === "wins" ? r.d! > 0 : filter === "losses" ? r.d! < 0 : r.d === 0))
      .sort((x, y) => (y.d ?? 0) - (x.d ?? 0));
  }, [data, activeArm, metric, filter]);

  return (
    <>
      <p className="muted small" style={{ margin: "0 0 14px" }}>
        Each method is compared question by question with <strong>{data.baseline}</strong>
        {data.clustered ? ", resampling whole documents" : ""} ({bundle.resamples.toLocaleString()} resamples).
        Created {new Date(bundle.created).toLocaleString()}.
      </p>
      {bundle.synthetic && (
        <div className="banner-synthetic" role="alert" style={{ marginBottom: 18 }}>
          Synthetic test data. These numbers were generated at random to exercise the interface and the harness;
          they are not results of any experiment.
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginBottom: 18 }}>
        <Segmented id="run-ds" label="Dataset" value={ds} onChange={(v) => setDs(v)} options={names.map((n) => ({ value: n, label: n }))} />
        <Segmented id="run-metric" label="Metric" value={metric} onChange={setMetric} options={metrics.map((m) => ({ value: m, label: m }))} />
        <button className="btn" style={{ marginLeft: "auto" }} onClick={onClear}>Load a different bundle</button>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)" }}>
        <div className="panel panel-pad">
          <h3 style={{ marginBottom: 8 }}>Difference from {data.baseline} in {metric}</h3>
          <Forest comps={comps} active={activeArm} onPick={setArm} />
        </div>
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Arm</th><th className="num">n</th><th className="num">{metric}</th><th className="num">Prompt tokens</th></tr></thead>
              <tbody>
                {Object.entries(data.arms).map(([a, s]) => (
                  <tr key={a}>
                    <td>{a}{a === data.baseline && <span className="chip chip-plain" style={{ marginLeft: 8 }}>baseline</span>}</td>
                    <td className="num">{s.n}</td>
                    <td className="num">{fmt(s[metric] as number | null)}</td>
                    <td className="num">{fmt(s.prompt_tokens as number | null, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <section style={{ marginTop: 36 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Queries, {activeArm} against {data.baseline}</h2>
          <Segmented id="run-filter" label="Filter queries" value={filter} onChange={setFilter}
            options={[{ value: "all", label: "All" }, { value: "wins", label: "Arm better" }, { value: "losses", label: "Baseline better" }, { value: "ties", label: "Tied" }]} />
          <span className="muted small">{rows.length} queries</span>
        </div>
        <div className="panel">
          <div className="table-wrap" style={{ maxHeight: 520, overflowY: "auto" }}>
            <table className="data">
              <thead><tr><th>Question</th><th>Document</th><th className="num">Baseline</th><th className="num">{activeArm}</th><th className="num">Difference</th></tr></thead>
              <tbody>
                {rows.slice(0, 400).map(({ q, d }) => (
                  <tr key={q.query_id} data-clickable tabIndex={0} onClick={() => setOpen(q)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(q)}>
                    <td style={{ maxWidth: 480 }}>{q.question}</td>
                    <td className="muted">{q.doc_id}</td>
                    <td className="num">{fmt(q.arms[data.baseline]?.metrics[metric])}</td>
                    <td className="num">{fmt(q.arms[activeArm]?.metrics[metric])}</td>
                    <td className="num" style={{ color: d! > 0 ? "var(--ok)" : d! < 0 ? "var(--bad)" : "var(--ink-3)", fontWeight: 500 }}>
                      {d! > 0 ? "+" : ""}{fmt(d)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="panel-pad muted" style={{ margin: 0 }}>No queries match this filter.</p>}
          </div>
        </div>
      </section>

      <Drawer open={open != null} onClose={() => setOpen(null)} title="Query detail">
        {open && (
          <div style={{ display: "grid", gap: 16, paddingTop: 30 }}>
            <div>
              <div className="small muted">{open.query_id}, document {open.doc_id}{open.type ? `, ${open.type}` : ""}</div>
              <h2 style={{ marginTop: 4 }}>{open.question}</h2>
              <div className="small">Gold: {open.gold_answers.join("; ")}</div>
            </div>
            {Object.entries(open.arms).map(([a, r]) => (
              <div key={a} className="panel panel-pad" style={{ display: "grid", gap: 8 }}>
                <h3>{a}{a === data.baseline ? " (baseline)" : ""}</h3>
                <div style={{ fontFamily: "var(--serif)" }}>{r.prediction || <span className="muted">Empty answer</span>}</div>
                <div className="small muted">
                  {Object.entries(r.metrics).map(([k, v]) => `${k} ${fmt(v)}`).join(", ")}, {r.prompt_tokens} prompt tokens
                </div>
                <div className="small">
                  {r.retrieved.map((c, i) => (
                    <div key={i}>#{i + 1} {c.id}, score {fmt(c.score)}, {c.tokens} tokens{c.context_tokens ? ` + ${c.context_tokens} context` : ""}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </>
  );
}

function Forest({ comps, active, onPick }: { comps: RunBundle["datasets"][string]["comparisons"][string]; active: string; onPick: (a: string) => void }) {
  const [ref, w] = useWidth<HTMLDivElement>(560);
  const entries = Object.entries(comps);
  const left = 150, right = 70, rowH = 34, top = 6;
  const h = top + entries.length * rowH + 28;
  const lo = Math.min(0, ...entries.map(([, c]) => c.ci_low));
  const hi = Math.max(0, ...entries.map(([, c]) => c.ci_high));
  const x = scaleLinear().domain([lo, hi]).range([left, w - right]).nice();
  return (
    <div ref={ref}>
      <svg className="forest" viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Paired differences with 95% intervals">
        {x.ticks(5).map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top} y2={h - 22} stroke={t === 0 ? "var(--ink)" : "var(--rule-soft)"} />
            <text x={x(t)} y={h - 6} textAnchor="middle">{t > 0 ? "+" : ""}{t}</text>
          </g>
        ))}
        {entries.map(([a, c], i) => {
          const y = top + i * rowH + rowH / 2;
          const sig = (c.p_holm ?? c.p) < 0.05;
          const col = a === active ? "var(--accent)" : "var(--ink-2)";
          return (
            <g key={a} style={{ cursor: "pointer" }} onClick={() => onPick(a)}>
              <rect x={0} y={y - rowH / 2} width={w} height={rowH} fill={a === active ? "var(--accent-soft)" : "transparent"} rx={3} />
              <text x={6} y={y + 4} style={{ fontWeight: a === active ? 600 : 400 }}>{a}</text>
              <motion.line y1={y} y2={y} stroke={col} strokeWidth={2} initial={false}
                animate={{ x1: x(c.ci_low), x2: x(c.ci_high) }} transition={{ duration: 0.25, ease: EASE }} />
              <motion.circle cy={y} r={5} fill={sig ? col : "var(--surface)"} stroke={col} strokeWidth={2} initial={false}
                animate={{ cx: x(c.delta) }} transition={{ duration: 0.25, ease: EASE }} />
              <text x={w - 4} y={y + 4} textAnchor="end">p {c.p_holm != null ? fmt(c.p_holm, 3) : fmt(c.p, 3)}</text>
            </g>
          );
        })}
      </svg>
      <p className="small muted" style={{ margin: "6px 0 0" }}>
        Point: mean paired difference. Line: 95% percentile bootstrap interval. Filled when the Holm-adjusted p is
        below 0.05. Click an arm to list its queries.
      </p>
    </div>
  );
}
