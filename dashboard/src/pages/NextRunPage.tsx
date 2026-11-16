import type { RunBundle } from "../lib/types";
import { ARMS, HYPOTHESES } from "../lib/content";
import { Disclosure, PageHead } from "../components/ui";
import RunsPage from "./RunsPage";

export default function NextRunPage({ bundle, onBundle }: { bundle: RunBundle | null; onBundle: (b: RunBundle | null) => void }) {
  return (
    <>
      <PageHead title="Next run"
        hint={<>press <strong>Try with synthetic test data</strong> to see how real results will look.</>}>
        The fair experiment that will settle the question. Its four tests are fixed in advance, and its results
        load straight into this page.
      </PageHead>

      <section style={{ marginTop: 0 }}>
        <h2>What it will test</h2>
        <ol className="hyp-list">
          {HYPOTHESES.map((h) => (
            <li key={h.id}>
              <span className="hyp-id">{h.id}</span>
              <span className="hyp-text">{h.text}</span>
              <span className="chip chip-plain">Not run yet</span>
            </li>
          ))}
        </ol>
        <div className="panel" style={{ marginTop: 14 }}>
          <Disclosure title="How the run stays fair" meta="Budgets, arms, statistics">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Every method gets the same prompt budget (512, 1,024 and 2,048 tokens), so no method wins by reading more.</li>
              <li>Each signal is tested alone and in combination: {ARMS.map((a) => a.name).join(", ")}.</li>
              <li>Context is attached to every chunker, not only STP, so a context gain can be traced to its cause.</li>
              <li>All HotpotQA and QASPER questions are used, and every question's outcome is saved.</li>
              <li>Confidence intervals come from resampling questions (or whole papers for QASPER), with Holm correction across the four tests.</li>
            </ul>
          </Disclosure>
        </div>
      </section>

      <section>
        <h2>Results</h2>
        <RunsPage bundle={bundle} onBundle={onBundle} />
      </section>
    </>
  );
}
