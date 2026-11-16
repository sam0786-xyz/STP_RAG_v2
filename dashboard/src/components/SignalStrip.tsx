import { motion } from "motion/react";
import type { Result, Step } from "../lib/chunkers";
import { EASE, useWidth } from "./ui";

/** One bar per gap between sentences, with the line the technique cuts above. */
export default function SignalStrip({ result, step, hoverGap, onHoverGap, sentences }: {
  result: Result;
  step: Step | null;
  hoverGap: number | null;
  onHoverGap: (g: number | null) => void;
  sentences: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(700);
  const sig = result.signal!;
  const gaps = Array.from({ length: Math.max(0, sentences - 1) }, (_, i) => i + 1);
  const vals = gaps.map((g) => sig.values[g] ?? 0);
  const top = Math.max(sig.threshold * 1.15, ...vals, 1e-6);
  const H = 84;
  const pad = 4;
  const bw = (width - pad * 2) / Math.max(1, gaps.length);
  const y = (v: number) => H - (Math.max(0, v) / top) * (H - 8);
  const cuts = new Set(result.steps.filter((s) => s.kind === "cut" || s.kind === "forced").map((s) => s.gap));
  const forced = new Set(result.steps.filter((s) => s.kind === "forced").map((s) => s.gap));
  // during a replay, bars appear as the reader reaches their gap
  const reached = step ? (step.kind === "end" ? sentences : doneGap(result, step)) : sentences;
  const hv = hoverGap !== null && hoverGap >= 1 && hoverGap < sentences ? hoverGap : null;

  return (
    <div className="strip">
      <div className="strip-label small">
        <span>{sig.label}</span>
        <span className="muted">{sig.thresholdLabel}</span>
      </div>
      <div ref={ref}>
        <svg width={width} height={H + 2} role="img" aria-label={sig.label} onMouseLeave={() => onHoverGap(null)}>
          {gaps.map((g, i) => {
            const v = vals[i];
            const visible = g <= reached;
            const isCut = visible && cuts.has(g);
            return (
              <g key={g} onMouseEnter={() => onHoverGap(g)}>
                <rect x={pad + i * bw} y={0} width={bw} height={H} fill="transparent" />
                <motion.rect x={pad + i * bw + bw * 0.18} width={Math.max(2, bw * 0.64)} rx={1.5} initial={false}
                  animate={{ y: visible ? y(v) : H, height: visible ? H - y(v) : 0 }} transition={{ duration: 0.25, ease: EASE }}
                  fill={isCut ? (forced.has(g) ? "var(--warn)" : "var(--accent)") : "var(--bar-idle)"}
                  stroke={hv === g || (step && step.kind !== "end" && step.gap === g) ? "var(--ink)" : "none"} strokeWidth={1.5} />
              </g>
            );
          })}
          <line x1={pad} x2={width - pad} y1={y(sig.threshold)} y2={y(sig.threshold)} stroke="var(--ink)" strokeDasharray="4 3" strokeWidth={1} />
          <line x1={pad} x2={width - pad} y1={H} y2={H} stroke="var(--rule)" />
        </svg>
      </div>
      <div className="strip-caption small" aria-live="polite">
        {hv !== null
          ? <>Gap before sentence {hv + 1}: <strong>{sig.format(sig.values[hv] ?? 0)}</strong>
            {cuts.has(hv) ? (forced.has(hv) ? ", cut forced by the size limit" : ", cut here") : ", no cut"}</>
          : <span className="muted">Hover a bar to find its gap in the text. Green bars are cuts{forced.size ? "; amber bars are cuts forced by the size limit" : ""}.</span>}
      </div>
    </div>
  );
}

/** The last gap the replay has decided so far. */
function doneGap(result: Result, step: Step): number {
  const idx = result.steps.indexOf(step);
  let g = 0;
  for (let k = 0; k <= idx; k++) g = Math.max(g, result.steps[k].decided ?? result.steps[k].gap ?? 0);
  return g;
}
