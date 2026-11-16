import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import type { Doc } from "../lib/doc";
import { sentenceOfWord } from "../lib/doc";
import type { Chunk, Settings, StpModel, TechId } from "../lib/chunkers";
import { TECHS, chunkText, runTechnique, techName } from "../lib/chunkers";
import { dot, embed, useEncoder } from "../lib/encoder";
import { ModelGate, TechSelect } from "../components/TechniquePanel";
import { tint } from "../components/ChunkedText";
import { EASE, PageHead, Segmented, Switch } from "../components/ui";

const TOP_K = 2;
const BUDGET = 120;
const isTech = (t: string | null): t is TechId => TECHS.some((x) => x.id === t);

interface Piece { chunk: number; range: Chunk; score: number; cut: boolean }
interface Column { tech: TechId; pieces: Piece[]; words: number; nChunks: number }

/** Rank chunks by cosine similarity to the question, then keep top-k or fill a word budget. */
function select(chunks: Chunk[], scores: number[], fair: boolean): Piece[] {
  const order = chunks.map((_, k) => k).sort((a, b) => scores[b] - scores[a]);
  if (!fair) return order.slice(0, TOP_K).map((k) => ({ chunk: k, range: chunks[k], score: scores[k], cut: false }));
  const out: Piece[] = [];
  let left = BUDGET;
  for (const k of order) {
    if (left <= 0) break;
    const c = chunks[k];
    const n = c.end - c.start;
    if (n <= left) out.push({ chunk: k, range: c, score: scores[k], cut: false });
    else out.push({ chunk: k, range: { start: c.start, end: c.start + left }, score: scores[k], cut: true });
    left -= Math.min(n, left);
  }
  return out;
}

export default function TryItPage({ samples, paper, custom, settings, model, params, sync, goPlay }: {
  samples: Doc[];
  paper: Doc;
  custom: Doc | null;
  settings: Settings;
  model: StpModel;
  params: URLSearchParams;
  sync: (p: Record<string, string | undefined | false>) => void;
  goPlay: () => void;
}) {
  const docs = [...samples, paper, ...(custom ? [custom] : [])];
  const d0 = params.get("d");
  const [docId, setDocId] = useState(docs.some((d) => d.id === d0) ? d0! : samples[0].id);
  const doc = docs.find((d) => d.id === docId)!;
  const q0 = Number(params.get("q"));
  const [qIdx, setQIdx] = useState<number | null>(params.get("q") !== null && Number.isInteger(q0) ? q0 : 0);
  const [draft, setDraft] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [techs, setTechs] = useState<TechId[]>(() => {
    const t = (params.get("t") ?? "").split("_").filter(isTech);
    return t.length === 3 ? t : ["fixed", "semantic", "stp"];
  });
  const [fair, setFair] = useState(params.get("fair") === "1");
  const enc = useEncoder();

  const questions = doc.questions ?? [];
  const preset = qIdx !== null && qIdx < questions.length ? questions[qIdx] : null;
  const question = asked ?? preset?.q ?? null;
  const gold = useMemo(() => new Set(asked ? [] : preset?.gold ?? []), [asked, preset]);

  useEffect(() => {
    sync({ d: docId, q: asked ? undefined : qIdx !== null ? String(qIdx) : undefined, t: techs.join("_"), fair: fair ? "1" : undefined });
  }, [docId, qIdx, asked, techs, fair, sync]);

  const results = useMemo(() => techs.map((t) => runTechnique(doc, t, settings, model)), [doc, techs, settings, model]);

  const [scores, setScores] = useState<{ key: string; byTech: number[][] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const key = `${doc.id}|${question}|${techs.join()}|${JSON.stringify(settings)}|${doc.sims ? 1 : 0}`;

  useEffect(() => {
    if (enc.status !== "ready" || !question) return;
    let live = true;
    const texts = results.map((r) => (r ? r.chunks.map((c) => chunkText(doc, c)) : []));
    const total = texts.reduce((a, t) => a + t.length, 0);
    setBusy(`Embedding the question and ${total} chunks…`);
    setErr(null);
    (async () => {
      const [qv] = await embed([question], true);
      const byTech: number[][] = [];
      for (const t of texts) {
        const vs = await embed(t);
        byTech.push(vs.map((v) => dot(v, qv)));
      }
      if (live) {
        setScores({ key, byTech });
        setBusy(null);
      }
    })().catch((e: Error) => live && (setErr(e.message), setBusy(null)));
    return () => {
      live = false;
    };
  }, [key, enc.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const sentOf = useMemo(() => sentenceOfWord(doc), [doc]);
  const columns: (Column | null)[] = techs.map((t, i) => {
    const r = results[i];
    if (!r || !scores || scores.key !== key) return null;
    const pieces = select(r.chunks, scores.byTech[i], fair);
    return { tech: t, pieces, words: pieces.reduce((a, p) => a + p.range.end - p.range.start, 0), nChunks: r.chunks.length };
  });
  const maxWords = Math.max(BUDGET, ...columns.map((c) => c?.words ?? 0));

  const status = (c: Column) => {
    if (!gold.size) return null;
    const goldRanges = [...gold].map((s) => ({ start: doc.sentences[s].w0, end: doc.sentences[s].w0 + doc.sentences[s].n }));
    const whole = goldRanges.every((g) => c.pieces.some((p) => p.range.start <= g.start && p.range.end >= g.end));
    if (whole) return { label: "Answer found", cls: "chip-ok" };
    const part = goldRanges.some((g) => c.pieces.some((p) => p.range.start < g.end && p.range.end > g.start));
    return part ? { label: "Answer cut in half", cls: "chip-warn" } : { label: "Answer missed", cls: "chip-bad" };
  };

  return (
    <>
      <PageHead title="Try it"
        hint={<>pick a question and see which technique hands the model the sentence that answers it. Then turn on <strong>Same word budget</strong>.</>}>
        This is the retrieval step of a RAG chatbot. Each technique cuts the document its own way, then an embedding
        model running in your browser picks the chunks closest to the question. Those chunks are all the language
        model would get to read.
      </PageHead>

      <div className="toolbar">
        <Segmented id="trydoc" label="Document" value={docId} onChange={(v) => { setDocId(v); setQIdx(0); setAsked(null); }}
          options={docs.map((d) => ({ value: d.id, label: d.id === "paper" ? "The paper" : d.title }))} />
        {!custom && <button className="btn btn-small" onClick={goPlay}>Use your own text…</button>}
      </div>

      <div className="chips" role="radiogroup" aria-label="Question">
        {questions.map((q, i) => (
          <button key={i} role="radio" aria-checked={!asked && i === qIdx} className="qchip" onClick={() => { setQIdx(i); setAsked(null); }}>
            {!asked && i === qIdx && <motion.span layoutId="qchip-bg" className="qchip-bg" transition={{ duration: 0.18, ease: EASE }} />}
            {q.q}
          </button>
        ))}
      </div>
      <form className="ask-row" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) setAsked(draft.trim()); }}>
        <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Or type your own question about this document"
          aria-label="Your question" />
        <button className="btn" type="submit" disabled={!draft.trim()}>Ask</button>
        {asked && <span className="small muted">Your own question has no marked answer, so the columns show what was retrieved but not whether it is right.</span>}
      </form>

      {enc.status !== "ready" ? (
        <div className="panel panel-pad">
          <ModelGate why="Retrieval compares the question with every chunk, so the question and the chunks have to be embedded. Nothing leaves your browser." />
        </div>
      ) : (
        <>
          <div className="toolbar toolbar-split">
            <Switch checked={fair} onChange={setFair} label={<>Same word budget for everyone <span className="muted">({BUDGET} words)</span></>} />
            <span className="small muted" aria-live="polite">
              {busy ?? err ?? (fair ? `Each technique fills ${BUDGET} words, best match first; the last chunk is cut to fit.` : `Each technique sends its top ${TOP_K} chunks, whatever their size.`)}
            </span>
          </div>

          <div className="method-cols">
            {techs.map((t, i) => {
              const c = columns[i];
              const st = c ? status(c) : null;
              return (
                <section key={i} className="panel method-col" aria-label={techName(t)}>
                  <header className="method-head">
                    <TechSelect value={t} onChange={(v) => setTechs(techs.map((x, j) => (j === i ? v : x)))} />
                    {st && <span className={`chip ${st.cls}`}>{st.label}</span>}
                  </header>
                  {!results[i] ? (
                    <p className="small muted">This technique needs sentence embeddings for this text. Open it once in the Playground with the model loaded.</p>
                  ) : !c ? (
                    <p className="small muted">Working…</p>
                  ) : (
                    <>
                      <div className="meter" role="img" aria-label={`${c.words} words sent`}>
                        <motion.div className="meter-fill" style={{ background: "var(--ink-2)" }} initial={false}
                          animate={{ width: `${(c.words / maxWords) * 100}%` }} transition={{ duration: 0.3, ease: EASE }} />
                        <div className="meter-mark" style={{ left: `${(BUDGET / maxWords) * 100}%` }} title={`${BUDGET} words`} />
                      </div>
                      <div className="small"><strong>{c.words}</strong> words sent to the model, from {c.nChunks} chunks in all</div>
                      <motion.div key={`${key}-${fair}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, ease: EASE }} style={{ display: "grid", gap: 10 }}>
                        {c.pieces.map((p, rank) => (
                          <div key={p.chunk} className="snippet" style={{ borderLeft: `3px solid ${tint(p.chunk)}`, paddingLeft: 10 }}>
                            <div className="snippet-meta">
                              Rank {rank + 1} · chunk {p.chunk + 1} · match {p.score.toFixed(2)} · {p.range.end - p.range.start} words{p.cut ? " (cut to fit)" : ""}
                            </div>
                            <SnippetText>{renderWords(doc, p.range, sentOf, gold)}</SnippetText>
                          </div>
                        ))}
                      </motion.div>
                    </>
                  )}
                </section>
              );
            })}
          </div>
          <p className="small muted" style={{ marginTop: 16 }}>
            The highlighted sentence is the one marked as the answer. Chunking settings come from the Playground, so
            change a slider there and come back. “Match” is the cosine similarity between the question and the chunk.
            A handful of questions on short texts cannot rank the techniques; the Evidence page covers the real experiment.
          </p>
        </>
      )}
    </>
  );
}

/** A scrolling snippet that brings the highlighted answer into view. */
function SnippetText({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const p = ref.current;
    const g = p?.querySelector<HTMLElement>(".gold");
    if (!p || !g) return;
    const top = g.offsetTop - p.offsetTop;
    // scroll only when the answer starts below what the box shows
    p.scrollTop = top + 16 > p.clientHeight ? Math.max(0, top - 8) : 0;
  });
  return <p ref={ref}>{children}</p>;
}

function renderWords(doc: Doc, r: Chunk, sentOf: Int32Array, gold: Set<number>) {
  const out: JSX.Element[] = [];
  let w = r.start;
  while (w < r.end) {
    const g = gold.has(sentOf[w]);
    let j = w + 1;
    while (j < r.end && gold.has(sentOf[j]) === g) j++;
    out.push(<span key={w} className={g ? "gold" : undefined}>{doc.words.slice(w, j).join(" ")} </span>);
    w = j;
  }
  return out;
}
