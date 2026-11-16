import { Fragment, useMemo } from "react";
import type { Doc } from "../lib/doc";
import { sentenceOfWord } from "../lib/doc";
import type { Result, Step } from "../lib/chunkers";

export const N_TINTS = 5;
export const tint = (k: number) => `var(--c${k % N_TINTS})`;
export const edge = (k: number) => `var(--c${k % N_TINTS}-edge)`;

type WordState = { a: number; b: number; open: boolean } | null; // a: first chunk, b: second (overlap) or -1

/** Which chunks own each word, and whether it is visible at this point of the replay. */
function wordStates(n: number, r: Result, step: Step | null): WordState[] {
  const out: WordState[] = Array(n).fill(null);
  r.chunks.forEach((c, k) => {
    const finished = !step || k < step.done;
    const open = !!step && k === step.done && c.start < step.cursor;
    if (!finished && !open) return;
    const end = finished ? c.end : Math.min(c.end, step!.cursor);
    for (let w = c.start; w < end; w++) {
      const s = out[w];
      if (!s) out[w] = { a: k, b: -1, open };
      else if (s.b === -1) out[w] = { ...s, b: k, open: s.open || open };
    }
  });
  return out;
}

export default function ChunkedText({ doc, result, step, selected, onSelect, hoverGap, onHoverSentence, showTopics }: {
  doc: Doc;
  result: Result;
  step: Step | null;
  selected: number | null;
  onSelect: (k: number | null) => void;
  hoverGap: number | null;
  onHoverSentence: (s: number | null) => void;
  showTopics: boolean;
}) {
  const sentOf = useMemo(() => sentenceOfWord(doc), [doc]);
  const states = useMemo(() => wordStates(doc.words.length, result, step), [doc, result, step]);
  const starts = useMemo(() => {
    const m = new Map<number, number>();
    result.chunks.forEach((c, k) => m.set(c.start, k));
    return m;
  }, [result]);
  const topicAt = new Map((showTopics ? doc.topics ?? [] : []).map((t) => [t.start, t.label]));

  // paragraphs -> sentences -> runs of words that share a state
  const paras: number[][] = [];
  doc.sentences.forEach((s, i) => {
    if (s.paraStart || !paras.length) paras.push([]);
    paras[paras.length - 1].push(i);
  });

  const renderSentence = (si: number) => {
    const s = doc.sentences[si];
    const nodes: JSX.Element[] = [];
    let w = s.w0;
    const end = s.w0 + s.n;
    while (w < end) {
      const k = starts.get(w);
      const st0 = states[w];
      if (k !== undefined && st0 && (st0.a === k || st0.b === k)) {
        const mid = w > 0 && sentOf[w - 1] === sentOf[w];
        nodes.push(
          <span key={`c${w}`} className="cut" data-mid={mid || undefined} data-first={k === 0 || undefined}
            style={{ ["--e" as string]: edge(k) }} title={k === 0 ? "Chunk 1 starts" : result.why[k]}>
            <span className="cut-badge">{mid ? "✂ " : ""}{k + 1}</span>
          </span>,
        );
      }
      let j = w + 1;
      const same = (x: WordState, y: WordState) => (x === null ? y === null : y !== null && x.a === y.a && x.b === y.b && x.open === y.open);
      while (j < end && !starts.has(j) && same(states[j], st0)) j++;
      const text = doc.words.slice(w, j).join(" ") + " ";
      if (!st0) nodes.push(<span key={w} className="w-pending">{text}</span>);
      else {
        const bg = st0.b === -1 ? tint(st0.a) : `repeating-linear-gradient(135deg, ${tint(st0.a)} 0 6px, ${tint(st0.b)} 6px 12px)`;
        const dim = selected !== null && st0.a !== selected && st0.b !== selected;
        nodes.push(
          <span key={w} className={`w-run${st0.open ? " w-open" : ""}${dim ? " w-dim" : ""}`} style={{ background: bg }}
            onClick={() => onSelect(selected === st0.a ? (st0.b !== -1 ? st0.b : null) : st0.a)}>
            {text}
          </span>,
        );
      }
      w = j;
    }
    const hl = hoverGap !== null && (si === hoverGap || si === hoverGap - 1);
    return (
      <Fragment key={si}>
        {topicAt.has(si) && <span className="topic-tag">{topicAt.get(si)}</span>}
        <span className={`sent${hl ? " sent-hl" : ""}`} onMouseEnter={() => onHoverSentence(si)} onMouseLeave={() => onHoverSentence(null)}>
          {nodes}
        </span>
      </Fragment>
    );
  };

  return (
    <div className="ctext" onMouseLeave={() => onHoverSentence(null)}>
      {paras.map((p, pi) => (
        <Fragment key={pi}>
          {doc.sentences[p[0]].heading && <h4 className="ctext-head">{doc.sentences[p[0]].heading}</h4>}
          <p>{p.map(renderSentence)}</p>
        </Fragment>
      ))}
    </div>
  );
}

export function ChunkRibbon({ result, step, selected, onSelect }: {
  result: Result;
  step: Step | null;
  selected: number | null;
  onSelect: (k: number | null) => void;
}) {
  return (
    <div className="ribbon" role="list" aria-label="Chunk sizes">
      {result.chunks.map((c, k) => {
        const n = c.end - c.start;
        const shown = !step || k < step.done || (k === step.done && c.start < step.cursor);
        return (
          <button key={k} role="listitem" className="ribbon-block" aria-pressed={selected === k}
            style={{ flexGrow: n, background: shown ? tint(k) : "var(--rule-soft)", borderColor: shown ? edge(k) : "transparent",
              opacity: selected !== null && selected !== k ? 0.45 : 1 }}
            title={`Chunk ${k + 1}: ${n} words`} onClick={() => onSelect(selected === k ? null : k)}>
            {shown && <span>{k + 1}</span>}
          </button>
        );
      })}
    </div>
  );
}
