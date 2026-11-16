import type { Demo } from "../lib/types";

/** The in-app "How to use" guide. Kept in sync with dashboard/HOW_TO_USE.md. */
export default function HelpGuide({ demo, onGo, onTour }: { demo: Demo; onGo: (r: string) => void; onTour: () => void }) {
  const Step = ({ route, title, children }: { route: string; title: string; children: React.ReactNode }) => (
    <li className="guide-step">
      <div className="guide-step-head">
        <h3>{title}</h3>
        <button className="btn btn-small" onClick={() => onGo(route)}>Open</button>
      </div>
      {children}
    </li>
  );
  return (
    <div className="guide">
      <h2 style={{ paddingTop: 30 }}>How to use this dashboard</h2>
      <p className="muted">
        Four pages, from simplest to most technical. Each has a “Try this” line under its title. To present it,
        use the <strong>Guided tour</strong>: seven steps that set up each view for you.
      </p>
      <button className="btn btn-primary" onClick={onTour}>▶ Start the guided tour</button>
      <ol className="guide-steps">
        <Step route="play" title="1. Playground">
          <p>Six chunking techniques on the same short text. Each coloured band is one chunk.</p>
          <ul>
            <li>Pick a text at the top: four samples, or <strong>Your own text</strong> to paste anything.</li>
            <li>Pick a technique from the tabs and move its slider. The bands update straight away.</li>
            <li>Press <strong>▶ Play</strong>. The technique reads the text step by step and says why it cuts or keeps going. ‹ and › step by hand.</li>
            <li>✂ marks a cut inside a sentence. Click any band, or a block in the size bar, to pick out one chunk.</li>
            <li>For Semantic and STP, the bars under the text show the score at each gap between sentences. Hover a bar to find its gap.</li>
            <li>Turn on <strong>Compare two</strong> to put two techniques side by side. <strong>Download chunks</strong> saves them as JSON.</li>
          </ul>
        </Step>
        <Step route="try" title="2. Try it">
          <p>The retrieval step of a RAG chatbot, run live in your browser.</p>
          <ul>
            <li>Press <strong>Load the model</strong> once (about 65 MB; the browser keeps it afterwards).</li>
            <li>Pick a document and a question, or type your own. Each column shows what one technique would hand the language model, with the answer sentence highlighted.</li>
            <li>Turn on <strong>Same word budget</strong> so no technique wins just by sending more text. Change a column's technique with its menu.</li>
          </ul>
        </Step>
        <Step route="how" title="3. How STP works">
          <p>The four signals behind STP's cuts, on the paper's Sections 1–3.</p>
          <ul>
            <li>Choose a preset and watch the green cut lines move. Click a block in the green strip to read that chunk; ← → step between chunks.</li>
            <li>Hover the chart to see one sentence's velocity, acceleration, volatility and cut score.</li>
          </ul>
        </Step>
        <Step route="evidence" title="4. Evidence">
          <p>What has been measured, and what will be.</p>
          <ul>
            <li><strong>What the pilot found</strong>: switch dataset and metric, click a bar for its full row, and open the five reasons the numbers are not final.</li>
            <li><strong>The next, fair run</strong>: the four hypotheses, and a drop zone for the harness's <code>run_bundle.json</code>. The synthetic test data is random; never cite it.</li>
          </ul>
        </Step>
      </ol>

      <h3 style={{ marginTop: 26 }}>What is real and what is a demo</h3>
      <ul className="muted small" style={{ paddingLeft: 18 }}>
        <li>The sample texts, their topic labels and their questions were written for this dashboard.</li>
        <li>Similarities come from {demo.encoder.name}: precomputed with fastembed for the samples, computed in your browser for your own text and for retrieval. The two agree to about 0.001.</li>
        <li>STP's weights are hand-set demo values, not calibrated. Its scalers are fitted on the four samples plus the paper's Sections 1–3.</li>
        <li>Pilot numbers are the audited aggregates, unchanged.</li>
      </ul>

      <h3 style={{ marginTop: 18 }}>Keyboard</h3>
      <ul className="muted small" style={{ paddingLeft: 18 }}>
        <li><kbd>?</kbd> opens this guide and <kbd>Esc</kbd> closes it.</li>
        <li><kbd>1</kbd>–<kbd>4</kbd> jump to the four pages.</li>
        <li>On How STP works, <kbd>←</kbd> and <kbd>→</kbd> move between chunks.</li>
      </ul>
      <p className="muted small">Every view has its own address: copy the URL to share exactly what you see.</p>
    </div>
  );
}
