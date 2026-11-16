# STP-RAG Evaluation 1 — speaker notes

Core presentation: slides 1–14. Slides 15–16 are Q&A backups. Suggested total: 10–12 minutes, subject to the actual evaluation time limit.

## Slide 1: STP-RAG

Rubric focus: Title.

Introduce the project in one sentence: we study how chunk boundaries and selectively attached context change evidence retrieval and answer quality. This deck follows the uploaded Evaluation 1 rubric; it is not a claim that every implementation detail has already been independently verified.

## Slide 2: What this evaluation should establish

Rubric focus: Rubric alignment | 50 marks.

The rubric contains eight five-mark categories plus ten guide marks: fifty in total. Spend most of the talk demonstrating feasibility, objectives, constraints, requirement traceability, and accountability. Communication is assessed throughout. Do not imply that this slide guarantees marks.

## Slide 3: The problem: a correct statement can lose its context

Rubric focus: Problem definition | illustrative diagram.

Explain the example without calling it an experimental result. The example only illustrates the dependency problem. Avoid saying that STP necessarily produces this boundary or always recovers the right context. Existing RAG and granularity work motivate the problem; the proposed focus is reuse of a transition profile across representation decisions.

## Slide 4: Four objectives with observable deliverables

Rubric focus: Formulation of project objectives | 5 marks.

Give the objective, then point to its acceptance check. Distinguish a requirement or planned deliverable from evidence that it has passed. O4 is not fully demonstrated by aggregate tables alone: configuration and prediction files are still needed.

## Slide 5: System architecture: representation first, retrieval second

Rubric focus: Requirements relevance | project-title alignment.

Explain v as local semantic displacement, a as change in that displacement, and sigma as local variability. The same profile is reused for representation decisions. Encoder revision and index backend are not confirmed in the supplied experiment record, so do not name a particular encoder or vector database as measured fact. Context ON/OFF is an ablation, not a second retrieval stage.

## Slide 6: Functional requirements trace directly to the title

Rubric focus: Relevance of project requirement specification | 5 marks.

Treat this as the proposed project requirement specification, not an assertion that all tests have passed. This table supports title relevance and makes the objectives testable. Do not use vague requirements such as 'the system should be accurate' without defining a measurement.

## Slide 7: Quality requirements: define how success is checked

Rubric focus: Quality of project requirement specification | 5 marks.

Explain one example: a retrieval time without hardware, caching conditions and timing boundaries is not a portable performance guarantee. For the final SRS, assign requirement IDs, priority, dependencies and agreed numeric resource ceilings after measuring available hardware. Do not invent latency targets or sample counts.

## Slide 8: Feasibility: what is supported, what remains uncertain

Rubric focus: Level of analysis of feasibility | 5 marks.

The supplied walkthrough reports completed implementation, calibration and tests, but their code and logs were not provided with the paper materials. Present this distinction confidently. Economic feasibility must be measured; local inference does not mean zero cost. Schedule feasibility needs actual dates agreed by the team and guide.

## Slide 9: Constraints and mitigations—not unsupported promises

Rubric focus: Relevant constraints | economic, environmental, safety and sustainability | 5 marks.

Map these directly to the rubric's economic, environmental, safety and sustainability examples. Environmental statements are design considerations, not measured energy results. Grounding is a proposed safeguard, not a guarantee that generated answers are correct.

## Slide 10: Validation plan: isolate components rather than add everything

Rubric focus: Feasibility and requirement verification.

Show how each arm answers an objective. Full STP versus velocity-only is not a clean structure-only or volatility-only test; those isolated controls are still absent. Dataset sample counts, retrieval setting and metric mappings must be supplied before making benchmark-wide claims.

## Slide 11: Preliminary evidence: context helps one dataset, hurts another

Rubric focus: Feasibility evidence | not a universal performance claim.

These are reported aggregate means, not rerun results. HotpotQA F1 increases from 0.344 to 0.410 versus velocity-only; against STP without context the gain is 0.127. QASPER F1 drops from 0.105 to 0.068 with context, and fixed-size is best overall in the supplied table. This is why feasibility and novelty should not be defended using a universal superiority claim. No significance or energy/cost claim follows from this figure.

## Slide 12: Responsibilities must be backed by actual artifacts

Rubric focus: Fulfillment of responsibilities | 5 marks.

Actual individual contributions were not supplied. The slide intentionally labels this as a proposal; replace it with an accurate allocation, commit history, logbook entries and guide-reviewed work before evaluation. Do not present proposed tasks as completed contributions. If the responsibilities differ, edit this slide.

## Slide 13: Milestones: reported progress vs verified evidence

Rubric focus: Feasibility, accountability and guide review.

Do not invent milestone completion dates or a guide endorsement. The walkthrough reports seventeen passing tests, but the test log is not among the supplied materials. Bring the actual test output if it exists. Use a dated logbook and an agreed schedule to demonstrate responsibility and readiness.

## Slide 14: Evaluation 1 takeaway

Rubric focus: Summary and discussion.

Close with what has been specified, what the preliminary data show, and what remains to be verified. Invite guide feedback on the requirement specification and feasibility constraints, rather than merely asking whether the result number is good. Use the two backup slides only if needed.

## Slide 15: Backup: all six ablation arms

Rubric focus: Q&A backup | complete comparison.

Use this table to avoid selective reporting. Higher recall is not the same as a better answer. Full STP does not reduce QASPER chunk count: it creates more chunks than velocity-only. If asked about p-values or the very narrow reported confidence intervals, state that the underlying bootstrap record must be audited.

## Slide 16: Backup: sources and evidence boundaries

Rubric focus: Written communication | references.

These references are reused from the manuscript, not newly reviewed literature for this deck. If asked for reproducibility, show actual experiment artifacts rather than treating the paper or these slides as evidence that code has been rerun. The teacher's rubric is the source of the presentation structure.