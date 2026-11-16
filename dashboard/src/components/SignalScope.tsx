import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { line, curveMonotoneX } from "d3-shape";
import { scaleLinear } from "d3-scale";
import type { ChunkTuple, Demo, MethodKey } from "../lib/types";
import { METHOD_COLOR } from "../lib/content";
import { fmt, useWidth } from "./ui";

const LANE_H = 58;
const LANE_GAP = 12;
const BAND_H = 15;
const BAND_GAP = 6;
const LEFT = 104;
const RIGHT = 10;
const TOP = 18;
const EASE = [0.23, 1, 0.32, 1] as const;

interface Props {
  demo: Demo;
  pi: (number | null)[];
  tauB: number;
  chunks: Record<MethodKey, ChunkTuple[]>;
  selected?: number;
  onSelect?: (chunk: number) => void;
}

export default function SignalScope({ demo, pi, tauB, chunks, selected, onSelect }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = demo.units.length;
  const innerW = width - LEFT - RIGHT;
  const uw = innerW / n;
  const x = (i: number) => LEFT + (i + 0.5) * uw;
  const edge = (i: number) => LEFT + i * uw;

  const lanes = useMemo(() => {
    const s = demo.signals;
    return [
      { key: "v", label: "Velocity v", values: s.v, color: "#0072B2" },
      { key: "a", label: "Acceleration a⁺", values: s.a, color: "#E69F00" },
      { key: "sigma", label: "Volatility σ", values: s.sigma, color: "#6a4c93" },
    ];
  }, [demo]);

  const headings = demo.units.map((u, i) => (u.heading ? i : -1)).filter((i) => i > 0);
  const laneTop = (k: number) => TOP + k * (LANE_H + LANE_GAP);
  const piTop = laneTop(3);
  const bandsTop = laneTop(4) + 8;
  const bandOrder: MethodKey[] = ["fixed", "similarity", "stp"];
  const height = bandsTop + bandOrder.length * (BAND_H + BAND_GAP) + 26;
  const stpCuts = chunks.stp.slice(1).map((c) => c[0]);

  const unit = hover != null ? demo.units[hover] : null;
  const tipLeft = hover != null ? Math.min(Math.max(x(hover) - 190, 0), width - 380) : 0;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Transition profile of ${n} sentences with ${chunks.stp.length} STP chunks. Use arrow keys to inspect sentences.`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
          if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? 1) - 1));
          if (e.key === "Escape") setHover(null);
          if ((e.key === "Enter" || e.key === " ") && hover != null && onSelect) {
            e.preventDefault();
            const k = chunks.stp.findIndex((c) => hover >= c[0] && hover <= c[1]);
            if (k >= 0) onSelect(k);
          }
        }}
        onBlur={() => setHover(null)}
      >
        {/* selected chunk highlight */}
        {selected != null && chunks.stp[selected] && (
          <motion.rect y={TOP - 4} height={bandsTop + 3 * (BAND_H + BAND_GAP) - BAND_GAP - TOP + 4} rx={3}
            fill="var(--accent)" fillOpacity={0.08} initial={false}
            animate={{ x: edge(chunks.stp[selected][0]), width: (chunks.stp[selected][1] - chunks.stp[selected][0] + 1) * uw }}
            transition={{ duration: 0.2, ease: EASE }} />
        )}
        {/* section heading markers */}
        {headings.map((h) => (
          <g key={`h${h}`}>
            <line x1={edge(h)} x2={edge(h)} y1={TOP - 10} y2={bandsTop + 3 * (BAND_H + BAND_GAP)} stroke="var(--ink)" strokeOpacity={0.12} strokeWidth={1} />
            <path d={`M${edge(h) - 4},${TOP - 12} L${edge(h) + 4},${TOP - 12} L${edge(h)},${TOP - 6} Z`} fill="var(--ink-2)" />
          </g>
        ))}

        {/* signal lanes */}
        {lanes.map((lane, k) => {
          const vals = lane.values.map((v) => v ?? 0);
          const y = scaleLinear().domain([0, Math.max(...vals) * 1.05 || 1]).range([laneTop(k) + LANE_H, laneTop(k)]);
          const shifted = line<number>().x((_, i) => x(i + 1)).y((v) => y(v)).curve(curveMonotoneX)(vals.slice(1)) ?? "";
          return (
            <g key={lane.key}>
              <text className="lane-label" x={0} y={laneTop(k) + 14}>{lane.label}</text>
              <line x1={LEFT} x2={width - RIGHT} y1={laneTop(k) + LANE_H} y2={laneTop(k) + LANE_H} stroke="var(--rule)" />
              <motion.path d={shifted} fill="none" stroke={lane.color} strokeWidth={1.6} strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, delay: 0.1 + k * 0.12, ease: EASE }} />
            </g>
          );
        })}

        {/* boundary probability lane (live) */}
        <text className="lane-label" x={0} y={piTop + 14}>Boundary π</text>
        <line x1={LEFT} x2={width - RIGHT} y1={piTop + LANE_H} y2={piTop + LANE_H} stroke="var(--rule)" />
        {pi.map((p, i) =>
          p == null ? null : (
            <rect key={i} x={x(i) - Math.max(1, uw * 0.28)} width={Math.max(2, uw * 0.56)}
              y={piTop + LANE_H * (1 - p)} height={LANE_H * p} rx={1}
              fill={p > tauB ? "var(--accent)" : "var(--ink-3)"} fillOpacity={p > tauB ? 0.9 : 0.35} />
          ),
        )}
        <line x1={LEFT} x2={width - RIGHT} y1={piTop + LANE_H * (1 - tauB)} y2={piTop + LANE_H * (1 - tauB)}
          stroke="var(--ink)" strokeDasharray="4 3" strokeWidth={1} />
        <text className="axis-text" x={0} y={piTop + LANE_H * (1 - tauB) + 4}>
          τ<tspan baselineShift="sub" fontSize="8">b</tspan> {tauB.toFixed(2)}
        </text>

        {/* live STP cuts through all lanes */}
        {stpCuts.map((c) => (
          <motion.line key={`cut${c}`} x1={edge(c)} x2={edge(c)} y1={TOP - 4} y2={piTop + LANE_H}
            stroke="var(--accent)" strokeWidth={1.25} initial={{ opacity: 0 }} animate={{ opacity: 0.55 }}
            transition={{ duration: 0.25, delay: 0.05 }} />
        ))}

        {/* chunk bands */}
        {bandOrder.map((m, b) => {
          const top = bandsTop + b * (BAND_H + BAND_GAP);
          return (
            <g key={m}>
              <text className="lane-label" x={0} y={top + 11}>
                {m === "fixed" ? "Fixed-size" : m === "similarity" ? "Similarity" : "STP (live)"}
              </text>
              {chunks[m].map((c, k) => (
                <motion.rect key={`${m}-${k}`} y={top} height={BAND_H} rx={2}
                  initial={false}
                  animate={{ x: edge(c[0]) + 0.5, width: Math.max(1, (c[1] - c[0] + 1) * uw - 1.5) }}
                  transition={{ duration: 0.22, ease: EASE }}
                  fill={METHOD_COLOR[m]} fillOpacity={k % 2 ? 0.5 : 0.85} />
              ))}
            </g>
          );
        })}

        {/* x axis */}
        {[0, 20, 40, 60, 80].filter((t) => t < n).map((t) => (
          <text key={t} className="axis-text" x={x(t)} y={height - 6} textAnchor="middle">{t + 1}</text>
        ))}
        <text className="axis-text" x={LEFT - 8} y={height - 6} textAnchor="end">sentence</text>

        {/* hover layer */}
        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={TOP - 4} y2={bandsTop + 3 * (BAND_H + BAND_GAP) - BAND_GAP}
            stroke="var(--ink)" strokeWidth={1} />
        )}
        <rect x={LEFT} y={0} width={innerW} height={height - 20} fill="transparent"
          onMouseMove={(e) => {
            const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
            const mx = ((e.clientX - r.left) / r.width) * width;
            setHover(Math.min(n - 1, Math.max(0, Math.floor((mx - LEFT) / uw))));
          }}
          onMouseLeave={() => setHover(null)}
          onClick={() => {
            if (hover == null || !onSelect) return;
            const k = chunks.stp.findIndex((c) => hover >= c[0] && hover <= c[1]);
            if (k >= 0) onSelect(k);
          }}
          style={{ cursor: onSelect ? "pointer" : undefined }} />
      </svg>

      {unit && hover != null && (
        <div className="tip" style={{ left: tipLeft, top: bandsTop - 150 > 0 ? 8 : 0 }} role="status">
          <div className="tip-meta">
            Sentence {hover + 1} of {n}, {unit.section}{unit.subsection ? `, ${unit.subsection}` : ""}, {unit.tokens} tokens
          </div>
          <div className="tip-text">{unit.text}</div>
          <div className="tip-meta" style={{ marginTop: 6 }}>
            v {fmt(demo.signals.v[hover])}, a⁺ {fmt(demo.signals.a[hover])}, σ {fmt(demo.signals.sigma[hover])}, π {fmt(pi[hover])}
            {unit.heading ? ", starts a section" : unit.para ? ", starts a paragraph" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
