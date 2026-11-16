# STP-RAG — Evaluation 1 presentation guide

## Deliverables

- `STP_RAG_Evaluation_1.pptx`: 16 widescreen slides, comprising 14 core slides and 2 Q&A backups. Text, tables, bars and diagrams are editable PowerPoint shapes, not screenshots of slides.
- `STP_RAG_Evaluation_1_Preview.pdf`: a visual design preview of the same 16 slides. This preview is generated from the shared slide specification; it is not a PowerPoint-rendered PDF.
- `SPEAKER_NOTES.md`: slide-by-slide speaking guidance, including cautions about unverified results and proposed responsibilities.
- `slide_content.json`: text, shape positions and notes used to build the deck.
- `paper_integrity.json`: SHA-256 checks confirming that the existing manuscript, compiled paper, bibliography, notes and result files did not change during generation.

The slide structure follows `prism-uploads/Screenshot 2026-09-15 at 11.05.22 AM.png`. The author names, title, study description and aggregate metrics come from the existing project materials. No research-paper files were edited. New references were not researched for this presentation; cited literature is reused from the paper.

## How the deck addresses the rubric

The image contains eight 5-mark criteria and one 10-mark criterion: **50 marks in total**.

| Criterion | Marks | Main slides | What to demonstrate |
|---|---:|---|---|
| Level of analysis of feasibility | 5 | 8, 10, 11, 13 | Technical, operational, economic and schedule feasibility; separate available evidence from reported or pending work. |
| Formulation of project objectives | 5 | 3–4 | A specific problem, four objectives and observable acceptance checks. |
| Identifying relevant constraints | 5 | 9 | Economic, environmental, safety, data and sustainability constraints, with mitigations rather than unsupported promises. |
| Relevance of requirements to the title | 5 | 5–6 | Map semantic transitions, adaptive chunking, selective context and retrieval to concrete functional requirements. |
| Quality of requirement specification | 5 | 6–7 | Requirement identifiers, clear behavior, verification artifacts, provenance and reproducibility criteria. |
| Fulfillment of responsibilities | 5 | 12–13 | Actual individual work, evidence files and progress records—not a generic list of roles. |
| Oral communication | 5 | Throughout | Explain diagrams, keep within the allotted time, use consistent terminology and answer questions directly. |
| Written communication | 5 | Throughout; 16 | Readable slides, labeled metrics, consistent acronyms, source attribution and accurate numbers. |
| Guide's marks | 10 | 12–14 and supporting records | Bring authentic guide-reviewed progress and address feedback. The image does not specify how these 10 marks are subdivided. |

This is an evidence checklist, not a prediction or guarantee of marks.

## Recommended diagrams — already included

### 1. Fixed boundary versus selective context — slide 3

Use an illustrative definition–dependency example to explain the problem before introducing equations. The diagram contrasts a statement retrieved alone with the same statement plus relevant earlier context. **Label it as an illustration, not an experimental observation.** The sensor-calibration example is invented only to explain the concept; it is not a dataset example or engineering recommendation.

### 2. System architecture — slide 5

Show two stages:

- Document construction: ordered units → embeddings → STP profile → adaptive chunks → selective context → index.
- Query time: question + index → top-five retrieval → local generation → answer and source context.

Keep the calibration/test boundary clear. Explain that the current experiments do not establish a separate secondary-retrieval controller. Do not name an encoder or database as the measured implementation unless the configuration confirms it.

### 3. Objective–requirement traceability matrix — slide 6

This is more useful for this rubric than an extra decorative architecture diagram. It ties each title term to a functional requirement, objective and acceptance artifact. Slide 7 extends the matrix to non-functional quality requirements.

### 4. Experimental workflow and ablation ladder — slide 10

Show development calibration, frozen parameters, the two datasets, three seeds and six comparison arms. The reported run count is **6 × 3 × 2 = 36**. This does not specify the number of documents or test questions.

### 5. Dataset-wise F1 bar charts — slide 11

Use the same vertical scale for both datasets. The four selected arms emphasize the key comparison, while backup slide 15 includes all six arms. State the unfavorable result as clearly as the favorable one:

- HotpotQA: context-arm F1 is 0.410, versus 0.344 for velocity-only and 0.283 for STP without context.
- QASPER: fixed-size F1 is 0.132; STP F1 is 0.105 and falls to 0.068 with context.

These are reported means, not proof of statistical significance. Full mean/standard-deviation tables remain in the unchanged paper.

### 6. Evidence and milestone roadmap — slide 13

Use the sequence **reported → available → verify next → review**. It shows readiness and accountability without inventing dates. Add a dated Gantt chart only after the actual owners, deadlines and guide-approved milestones are known.

### Optional diagrams for questions

- **Latency versus Recall@5:** the existing paper diagram can support a cost/quality question. Distinguish retrieval time from total response time and hardware-independent performance.
- **Context attachment ON/OFF comparison:** explain the +0.127 HotpotQA F1 and −0.037 QASPER F1 differences against STP without context.
- **Reference/provenance example:** show one genuine retrieved source span and the attached context when actual retrieval logs are available.

Avoid invented semantic-transition traces, fake confidence intervals, pie charts of performance, cost-saving graphics without cost measurements, or a Gantt chart with made-up completion dates.

## What to confirm before presenting

1. **Actual team responsibilities.** Slide 12 is explicitly a proposed allocation, not a claim of completed individual contributions. Confirm the owners or replace them with the real allocation. Bring commits, logs, notebooks or dated work records.
2. **Guide name and presentation limit.** The guide's name was not provided and has not been invented. Confirm the duration and adjust the slide count if necessary.
3. **The implementation configuration.** Confirm encoder/model revisions, index backend, hardware, chunk bounds, context budget and generation settings from actual files.
4. **Sample counts and evaluation scope.** Supply documents, questions, split manifests, the HotpotQA retrieval setting, and the QASPER scoring rules.
5. **Execution evidence.** The walkthrough reports implementation, calibration and 17 passing tests. This deck does not independently verify those claims; bring the corresponding code and logs.
6. **Statistical conclusions.** Do not defend the reported narrow bootstrap intervals as established significance until the paired predictions and resampling procedure have been audited.
7. **Resource limits.** For a final SRS, add guide-approved quantitative limits based on available hardware, not guessed latency, budget or energy targets.
8. **PowerPoint display.** Open the `.pptx` in PowerPoint and check the font rendering, arrow glyphs, line breaks and editable shapes before evaluation. The package XML and internal links are checked, but PowerPoint/LibreOffice is not available in this environment for native rendering. Use the preview PDF as a design reference.

## Suggested speaking sequence

Allow approximately **10–12 minutes for slides 1–14**, subject to the actual evaluation limit. Spend less time on the rubric overview and more on objectives, architecture, requirement quality, feasibility and responsibilities. Keep slides 15–16 for questions.

- Slides 1–3: project identity and the problem.
- Slides 4–7: objectives, design and requirements.
- Slides 8–10: feasibility, constraints and the verification plan.
- Slide 11: a short, balanced feasibility result—not a final-results defense.
- Slides 12–14: real responsibilities, next work and guide feedback.

Use the diagram to tell the story; do not read each box. Define RAG and STP once. On the results slide, distinguish **retrieval quality** from **answer quality** and **percentage-point/score differences** from relative percentages.

## Likely questions and safe answers

**What is new?** The proposed focus is an explicit velocity–acceleration–volatility profile reused across chunking and context decisions, not the invention of RAG, semantic chunking or contextual retrieval.

**Why use STP if fixed-size wins on QASPER?** The hypothesis is task-dependent. The ablations reveal when the extra representation complexity helps or hurts; the current results do not justify replacing fixed-size everywhere.

**Where is the clearest gain?** The context arm achieves HotpotQA F1 of 0.410: +0.066 against velocity-only and +0.127 against STP without context. Those are different baselines.

**Does full STP reduce fragmentation?** Not in the supplied QASPER aggregates: its chunk count is 47.959 per document, compared with 41.796 for velocity-only. Do not claim demonstrated section preservation from these numbers.

**Is this proven efficient?** Only local aggregate build and retrieval timings are available. Hardware, corpus scale, token budget and end-to-end timing are not fully documented.

**Have you proved an environmental benefit?** No. Caching and bounded computation are mitigation ideas; energy savings have not been measured.

**What exactly did each team member do?** Answer using actual artifacts and the confirmed allocation. The deck's proposed responsibility slide is not evidence of past work.

**What is the next deliverable?** A complete, auditable experiment record and a requirement-verification checklist, followed by controlled reruns and paired uncertainty analysis.

## Rebuilding

From the workspace root, run `python presentation/build_presentation.py`. The generator uses standard-library OOXML packaging and the installed Pillow package; it does not install dependencies or create an environment. Arial font files are read from the existing system font directory using a workspace-relative path. The build reads the current result CSV, saves new presentation outputs only inside `presentation/`, and writes temporary slide previews outside the project in the designated temporary preview directory.