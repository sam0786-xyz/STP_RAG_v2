import { useEffect, useState } from "react";
import type { Doc } from "../lib/doc";
import { MAX_WORDS } from "../lib/doc";
import type { Settings, StpModel, TechId } from "../lib/chunkers";
import { TECHS, chunkText, runTechnique, techName } from "../lib/chunkers";
import TechniquePanel, { TechTabs } from "../components/TechniquePanel";
import { Disclosure, PageHead, Segmented, Switch } from "../components/ui";

export interface CustomText {
  text: string;
  doc: Doc | null;
  apply: (text: string) => void;
}

const isTech = (t: string | null): t is TechId => TECHS.some((x) => x.id === t);

export default function PlaygroundPage({ samples, custom, settings, onSettings, model, params, sync }: {
  samples: Doc[];
  custom: CustomText;
  settings: Settings;
  onSettings: (s: Settings) => void;
  model: StpModel;
  params: URLSearchParams;
  sync: (p: Record<string, string | undefined | false>) => void;
}) {
  const s0 = params.get("s");
  const [source, setSource] = useState<string>(s0 === "custom" || samples.some((d) => d.id === s0) ? s0! : samples[0].id);
  const [tech, setTech] = useState<TechId>(isTech(params.get("t")) ? (params.get("t") as TechId) : "fixed");
  const [tech2, setTech2] = useState<TechId | null>(isTech(params.get("t2")) ? (params.get("t2") as TechId) : null);
  const [showTopics, setShowTopics] = useState(params.get("topics") !== "0");
  const [autoplay] = useState(params.get("play") === "1");
  const [draft, setDraft] = useState(custom.text);

  useEffect(() => {
    sync({ s: source, t: tech, t2: tech2 ?? undefined, topics: showTopics ? undefined : "0" });
  }, [source, tech, tech2, showTopics, sync]);

  const doc = source === "custom" ? custom.doc : samples.find((d) => d.id === source)!;
  const draftWords = draft.split(/\s+/).filter(Boolean).length;

  const download = () => {
    if (!doc) return;
    const one = (t: TechId) => {
      const r = runTechnique(doc, t, settings, model);
      return {
        technique: techName(t),
        settings: settingsFor(t, settings),
        size_unit: "words",
        chunks: r ? r.chunks.map((c, k) => ({ index: k + 1, start_word: c.start, end_word: c.end, words: c.end - c.start, text: chunkText(doc, c) })) : "needs the embedding model",
      };
    };
    const body = { text: doc.title, created: new Date().toISOString(), results: [tech, ...(tech2 ? [tech2] : [])].map(one) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `chunks-${doc.id}-${tech}${tech2 ? `-vs-${tech2}` : ""}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHead title="Playground"
        hint={<>pick a technique, then press <strong>▶ Play</strong> to watch it decide where each chunk ends.</>}>
        Before a chatbot can search a document, the document is cut into chunks. Here are six ways to do that on the
        same short text. Each coloured band is one chunk.
      </PageHead>

      <div className="toolbar">
        <Segmented id="source" label="Text" value={source} onChange={setSource}
          options={[...samples.map((d) => ({ value: d.id, label: d.title })), { value: "custom", label: "Your own text" }]} />
      </div>

      {source === "custom" && (
        <div className="panel editor">
          <label htmlFor="custom-text" className="small"><strong>Paste any text.</strong> Leave a blank line between paragraphs. Up to {MAX_WORDS.toLocaleString()} words.</label>
          <textarea id="custom-text" value={draft} onChange={(e) => setDraft(e.target.value)} rows={7}
            placeholder="Paste a few paragraphs here: an article, a policy, your notes…" />
          <div className="editor-row">
            <button className="btn btn-primary" disabled={!draftWords || draftWords > MAX_WORDS || draft === custom.text && !!custom.doc}
              onClick={() => custom.apply(draft)}>Chunk this text</button>
            <span className={`small ${draftWords > MAX_WORDS ? "bad" : "muted"}`}>{draftWords.toLocaleString()} words</span>
            <span className="small muted">It stays in your browser.</span>
          </div>
        </div>
      )}

      {doc && (
        <>
          <div className="toolbar toolbar-split">
            <div className="small muted">
              <strong className="ink">{doc.title}</strong> · {doc.kind}{doc.blurb ? ` · ${doc.blurb}` : ""}
            </div>
            <div className="toolbar">
              {doc.topics && <Switch checked={showTopics} onChange={setShowTopics} label="Show topic labels" />}
              <Switch checked={tech2 !== null} onChange={(on) => setTech2(on ? (tech === "stp" ? "fixed" : "stp") : null)} label="Compare two" />
              <button className="btn btn-small" onClick={download}>Download chunks (JSON)</button>
            </div>
          </div>

          {tech2 === null ? (
            <>
              <TechTabs id="main" value={tech} onChange={setTech} />
              <TechniquePanel key={`${doc.id}-${tech}`} doc={doc} tech={tech} settings={settings} onSettings={onSettings}
                model={model} showTopics={showTopics} autoplay={autoplay} />
            </>
          ) : (
            <div className="compare-2">
              <TechniquePanel key={`a-${doc.id}-${tech}`} doc={doc} tech={tech} onTech={setTech} settings={settings} onSettings={onSettings}
                model={model} showTopics={showTopics} compact />
              <TechniquePanel key={`b-${doc.id}-${tech2}`} doc={doc} tech={tech2} onTech={setTech2} settings={settings} onSettings={onSettings}
                model={model} showTopics={showTopics} compact />
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <Disclosure title="What the numbers under the text mean" meta="And what they do not show">
              <ul className="plain-list">
                <li><strong>Sentences cut in half</strong>: a chunk edge falls inside a sentence, so neither chunk has the whole sentence.</li>
                <li><strong>Topic changes on a chunk edge</strong> and <strong>chunks that mix two topics</strong> compare the cuts with topic labels marked by hand on the sample texts, which were written for this dashboard. They are a reading aid, not a benchmark.</li>
                <li>Sizes are counted in words. Real systems count tokens, roughly 1.3 per English word.</li>
                <li>Semantic and STP use sentence embeddings from BAAI/bge-small-en-v1.5. On texts this short a single sentence can move the similarity a lot, so neither method finds every topic change. The STP weights are the same hand-set demo values as on the How STP works page; they were not tuned on these texts.</li>
                <li>A chunking that looks tidy is not proof that answers improve. The Try it page shows retrieval, and the Evidence page shows what has been measured so far.</li>
              </ul>
            </Disclosure>
          </div>
        </>
      )}
    </>
  );
}

function settingsFor(t: TechId, s: Settings) {
  switch (t) {
    case "fixed": return { chunk_size_words: s.fixed.size };
    case "overlap": return { chunk_size_words: s.overlap.size, overlap_words: s.overlap.overlap };
    case "sentence": return { sentences_per_chunk: s.sentence.per };
    case "recursive": return { max_words: s.recursive.max };
    case "semantic": return { sharpest_gaps_percent: s.semantic.pct };
    case "stp": return { tau_b: s.stp.tau, L_max_words: s.stp.max, L_t_words: Math.round(s.stp.max * 0.55), L_min_words: Math.round(s.stp.max * 0.2) };
  }
}
