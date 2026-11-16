import { AnimatePresence, motion } from "motion/react";
import { EASE } from "./ui";

/** A presenter's tour: each step is a link (page + settings) and one thing to say about it. */
export const TOUR: { hash: string; title: string; text: string }[] = [
  { hash: "#/play?s=handbook&t=fixed", title: "Fixed size",
    text: "The simplest way to chunk: every 50 words, cut. The ✂ marks show cuts that land in the middle of a sentence. The numbers under the text count them." },
  { hash: "#/play?s=handbook&t=recursive", title: "Recursive",
    text: "Recursive splitting respects paragraphs and sentences, so nothing is cut in half. But it only sees layout: in this handbook, leave and expenses share a paragraph." },
  { hash: "#/play?s=handbook&t=stp&play=1", title: "STP, step by step",
    text: "STP scores every gap between sentences from how much the meaning moves there. Watch the replay: each step says why it cut or kept going." },
  { hash: "#/play?s=plant&t=semantic&t2=stp", title: "Semantic against STP",
    text: "Both cut by meaning. Compare the two on the plant leaflet, where repotting starts halfway through a paragraph. Look at the topic counts under each." },
  { hash: "#/try?d=handbook&q=1", title: "What gets retrieved",
    text: "A real embedding model picks the chunks closest to the question. Turn on the same word budget so no technique wins by sending more text." },
  { hash: "#/how", title: "Inside STP",
    text: "The four signals behind each cut, on the paper's own Sections 1–3. Click a chunk to read it." },
  { hash: "#/evidence", title: "The evidence so far",
    text: "The pilot's numbers, and the five reasons they cannot settle the question yet. The second tab is the fair experiment that will." },
];

export default function Tour({ step, onStep, onClose }: { step: number | null; onStep: (k: number) => void; onClose: () => void }) {
  return (
    <AnimatePresence>
      {step !== null && (
        <motion.aside className="tour" role="dialog" aria-label="Guided tour" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.22, ease: EASE }}>
          <div className="tour-top">
            <span className="small muted">Tour · {step + 1} of {TOUR.length}</span>
            <button className="linkish small" onClick={onClose}>End tour</button>
          </div>
          <motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
            <h3>{TOUR[step].title}</h3>
            <p>{TOUR[step].text}</p>
          </motion.div>
          <div className="tour-progress" aria-hidden="true">
            {TOUR.map((_, k) => <span key={k} data-on={k <= step || undefined} />)}
          </div>
          <div className="tour-row">
            <button className="btn btn-small" disabled={step === 0} onClick={() => onStep(step - 1)}>Back</button>
            {step < TOUR.length - 1
              ? <button className="btn btn-primary btn-small" onClick={() => onStep(step + 1)}>Next</button>
              : <button className="btn btn-primary btn-small" onClick={onClose}>Finish</button>}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
