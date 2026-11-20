from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile
import csv
import hashlib
import json
import math
import posixpath
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path("presentation")
PREVIEWS = Path("../../tmp/prism-pdf-previews/evaluation-1")
WIDTH, HEIGHT, EMU = 1600, 900, 7620
FONT_ROOT = Path("../../usr/share/fonts/truetype/msttcorefonts")
NAVY = "14283F"
TEAL = "007F82"
BLUE = "2768B4"
ORANGE = "D88715"
RED = "B34E4E"
MUTED = "5C6D7E"
PAPER = "F4F7FA"
WHITE = "FFFFFF"
PALE = "E7F3F2"
BORDER = "D9E2EA"
SLIDES = []
WARNINGS = []
METHODS = ["Fixed-size", "Similarity-threshold", "Velocity-only", "Velocity + acceleration", "Full STP", "Full STP + selective context"]


def font(size, bold=False):
    return ImageFont.truetype(str(FONT_ROOT / ("Arial_Bold.ttf" if bold else "Arial.ttf")), round(size * 5 / 3))


def wrap_text(content, width, size, bold):
    typeface = font(size, bold)
    lines = []
    for paragraph in str(content).split("\n"):
        current = ""
        for word in paragraph.split():
            candidate = (current + " " + word).strip()
            if current and typeface.getlength(candidate) > width:
                lines.append(current)
                current = word
            else:
                current = candidate
        lines.append(current)
    return lines


class Slide:
    def __init__(self, title, category, source="STP-RAG | Evaluation 1", dark=False):
        self.title = title
        self.category = category
        self.background = NAVY if dark else PAPER
        self.shapes = []
        self.notes = ""
        self.image = Image.new("RGB", (WIDTH, HEIGHT), "#" + self.background)
        self.draw = ImageDraw.Draw(self.image)
        SLIDES.append(self)
        if not dark:
            self.rect(0, 0, 14, HEIGHT, TEAL)
            self.text(category.upper(), 62, 28, 1480, 28, 11, TEAL, True)
            self.text(title, 62, 72, 1470, 85, 29, NAVY, True)
            self.line(62, 824, 1538, 824, BORDER, 1)
            self.text(source, 62, 841, 1390, 35, 9.5, MUTED)
            self.text(f"{len(SLIDES):02d}", 1480, 838, 58, 36, 12, TEAL, True, "right")

    def rect(self, horizontal, vertical, width, height, fill=WHITE, stroke=None, radius=14):
        self.shapes.append(dict(kind="rect", x=horizontal, y=vertical, w=width, h=height, fill=fill, stroke=stroke, radius=radius))
        self.draw.rounded_rectangle((horizontal, vertical, horizontal + width, vertical + height), radius=radius, fill="#" + fill, outline="#" + stroke if stroke else None, width=2)

    def line(self, start_x, start_y, end_x, end_y, color=BORDER, width=2):
        self.shapes.append(dict(kind="line", x=start_x, y=start_y, x2=end_x, y2=end_y, color=color, width=width))
        self.draw.line((start_x, start_y, end_x, end_y), fill="#" + color, width=width)

    def text(self, content, horizontal, vertical, width, height, size=18, color=NAVY, bold=False, align="left"):
        lines = wrap_text(content, width, size, bold)
        line_height = size * 2
        if len(lines) * line_height > height + 4:
            WARNINGS.append(f"Slide {len(SLIDES)} text exceeds box: {content[:70]}")
        if horizontal < 0 or vertical < 0 or horizontal + width > WIDTH or vertical + height > HEIGHT:
            WARNINGS.append(f"Slide {len(SLIDES)} text outside slide: {content[:70]}")
        self.shapes.append(dict(kind="text", x=horizontal, y=vertical, w=width, h=height, size=size, color=color, bold=bold, align=align, lines=lines))
        typeface = font(size, bold)
        for index, line in enumerate(lines):
            offset = 0
            if align == "center":
                offset = (width - typeface.getlength(line)) / 2
            elif align == "right":
                offset = width - typeface.getlength(line)
            self.draw.text((horizontal + offset, vertical + index * line_height), line, font=typeface, fill="#" + color, anchor="lt")

    def card(self, horizontal, vertical, width, height, heading, body, accent=TEAL, size=18):
        self.rect(horizontal, vertical, width, height)
        self.rect(horizontal, vertical, 6, height, accent, radius=0)
        self.text(heading, horizontal + 24, vertical + 19, width - 48, 58, 20, accent, True)
        self.text(body, horizontal + 24, vertical + 83, width - 48, height - 95, size)

    def band(self, content, vertical=747, fill=PALE, color=TEAL, size=17):
        self.rect(62, vertical, 1476, 59, fill)
        self.text(content, 83, vertical + 13, 1434, 42, size, color, True)

    def node(self, label, horizontal, vertical, width=240, height=92, fill=PALE, color=TEAL):
        self.rect(horizontal, vertical, width, height, fill, BORDER)
        lines = wrap_text(label, width - 24, 17, True)
        self.text(label, horizontal + 12, vertical + (height - len(lines) * 34) / 2, width - 24, len(lines) * 34 + 4, 17, color, True, "center")

    def arrow(self, horizontal, vertical, direction="right", color=TEAL, width=50):
        self.text("→" if direction == "right" else "↓", horizontal, vertical, width, 60, 27, color, True, "center")


def table(slide, headers, rows, horizontal, vertical, widths, row_height=91, font_size=16):
    total = sum(widths)
    slide.rect(horizontal, vertical, total, 57, NAVY, radius=0)
    cursor = horizontal
    for header, width in zip(headers, widths):
        slide.text(header, cursor + 14, vertical + 15, width - 28, 39, font_size, WHITE, True)
        cursor += width
    for row_number, values in enumerate(rows):
        top = vertical + 57 + row_number * row_height
        slide.rect(horizontal, top, total, row_height, WHITE if row_number % 2 == 0 else "EAF0F5", radius=0)
        cursor = horizontal
        for value, width in zip(values, widths):
            slide.text(value, cursor + 14, top + 17, width - 28, row_height - 22, font_size)
            cursor += width


def read_results():
    with Path("archive/v1_paper/results/summary_metrics.csv").open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    return {(row["dataset"], row["method"]): row for row in rows}


def build_slides(results):
    slide = Slide("STP-RAG", "Title", dark=True)
    slide.text("EVALUATION 1  /  15 SEPTEMBER 2026", 72, 64, 1420, 45, 14, "6ED4CC", True)
    slide.text("STP-RAG", 72, 164, 1050, 135, 62, WHITE, True)
    slide.text("Semantic Transition Profiles for\nAdaptive Chunking and Selective Context", 78, 314, 1390, 145, 30, WHITE, True)
    slide.rect(78, 502, 1360, 74, "203E56")
    slide.text("A feasibility, requirements, and evidence-led project presentation", 104, 524, 1305, 43, 21, "A6E4DC")
    slide.text("Mohammad Sameer  •  Rajeev Kumar Gupta  •  Mohit Dev Tomar", 78, 642, 1420, 55, 20, WHITE)
    slide.text("Department of Computer Science and Engineering\nSharda School of Computing Science and Engineering, Sharda University", 78, 716, 1390, 78, 16, "C2D1DE")
    slide.notes = "Introduce the project in one sentence: we study how chunk boundaries and selectively attached context change evidence retrieval and answer quality. This deck follows the uploaded Evaluation 1 rubric; it is not a claim that every implementation detail has already been independently verified."

    slide = Slide("What this evaluation should establish", "Rubric alignment | 50 marks", "Source: uploaded evaluation rubric, September 15, 2026")
    criteria = [
        ("Feasibility", "Technical, operational, cost and schedule analysis", "5"),
        ("Project objectives", "Specific goals with measurable acceptance checks", "5"),
        ("Relevant constraints", "Economic, environmental, safety and sustainability", "5"),
        ("Requirements relevance", "Every requirement connects to the project title", "5"),
        ("Requirements quality", "Clear, testable functional and non-functional criteria", "5"),
        ("Responsibilities", "Named ownership backed by actual work evidence", "5"),
        ("Oral communication", "Explain the diagrams, trade-offs and limitations", "5"),
        ("Written communication", "Readable slides, consistent terms and citations", "5"),
        ("Guide's assessment", "Review evidence and address the guide's feedback", "10"),
    ]
    for index, (heading, body, mark) in enumerate(criteria):
        horizontal = 62 + (index % 3) * 501
        vertical = 170 + (index // 3) * 191
        slide.rect(horizontal, vertical, 474, 168)
        slide.text(heading, horizontal + 18, vertical + 18, 368, 45, 18, TEAL, True)
        slide.text(mark, horizontal + 400, vertical + 16, 55, 43, 23, BLUE, True, "right")
        slide.text(body, horizontal + 18, vertical + 73, 437, 80, 15)
    slide.band("Focus: a justified project plan and specification—not only model accuracy.")
    slide.notes = "The rubric contains eight five-mark categories plus ten guide marks: fifty in total. Spend most of the talk demonstrating feasibility, objectives, constraints, requirement traceability, and accountability. Communication is assessed throughout. Do not imply that this slide guarantees marks."

    slide = Slide("The problem: a correct statement can lose its context", "Problem definition | illustrative diagram", "Background: Lewis et al., 2020; Chen et al., 2024. Toy example—not benchmark evidence.")
    slide.text("Question: Which calibration factor applies to sensor A?", 65, 165, 1470, 60, 23, NAVY, True)
    slide.card(62, 260, 703, 270, "Fixed boundary: dependency split", "Chunk 1: “The calibration factor is 0.85.”\nChunk 2: “Apply this factor only to sensor A.”", RED, 20)
    slide.card(835, 260, 703, 270, "Context: evidence reconnected", "Retrieved statement + relevant earlier context:\n“Factor = 0.85” + “applies to sensor A.”", TEAL, 20)
    slide.arrow(774, 345, width=52)
    slide.text("Risk: a retrieved chunk may be relevant but incomplete.", 82, 558, 674, 102, 21, RED, True)
    slide.text("Design goal: preserve useful dependencies without copying everything.", 853, 558, 650, 142, 20, TEAL, True)
    slide.band("Research question: when do transition signals and selected context help—and when do they hurt?", size=16)
    slide.notes = "Explain the example without calling it an experimental result. The example only illustrates the dependency problem. Avoid saying that STP necessarily produces this boundary or always recovers the right context. Existing RAG and granularity work motivate the problem; the proposed focus is reuse of a transition profile across representation decisions."

    slide = Slide("Four objectives with observable deliverables", "Formulation of project objectives | 5 marks")
    objectives = [
        ("O1  Adaptive representation", "Compute velocity, acceleration, volatility and structural cues; construct bounded, source-linked chunks.", "Check: deterministic signals and valid boundaries."),
        ("O2  Selective context", "Attach relevant earlier units as an optional component rather than copying all previous text.", "Check: compare the same STP arm with context OFF / ON."),
        ("O3  Controlled evaluation", "Compare six arms on HotpotQA and QASPER with consistent retrieval and generation settings.", "Check: Recall@5, MRR, EM and F1 for every arm."),
        ("O4  Cost and reproducibility", "Record chunk count, build time, retrieval latency, configurations and predictions.", "Check: a complete run manifest and reproducible outputs."),
    ]
    for index, (heading, body, check) in enumerate(objectives):
        horizontal = 62 + (index % 2) * 753
        vertical = 169 + (index // 2) * 278
        slide.card(horizontal, vertical, 723, 252, heading, body, size=18)
        slide.text(check, horizontal + 24, vertical + 192, 672, 57, 15, TEAL, True)
    slide.band("Objectives define what will be tested; they do not promise that STP wins on every dataset.", size=16)
    slide.notes = "Give the objective, then point to its acceptance check. Distinguish a requirement or planned deliverable from evidence that it has passed. O4 is not fully demonstrated by aggregate tables alone: configuration and prediction files are still needed."

    slide = Slide("System architecture: representation first, retrieval second", "Requirements relevance | project-title alignment")
    slide.text("DOCUMENT CONSTRUCTION", 62, 171, 1465, 37, 14, TEAL, True)
    top_nodes = [("Ordered units\n+ structure", 62), ("Unit\nembeddings", 365), ("STP profile\nv, a, σ, S", 668), ("Adaptive\nchunks", 971), ("Selective\ncontext", 1274)]
    for label, horizontal in top_nodes:
        slide.node(label, horizontal, 224, 264, 98)
        if horizontal < 1274:
            slide.arrow(horizontal + 264, 244, width=39)
    slide.text("Dev calibration → frozen parameters; no test-set tuning", 366, 362, 1165, 43, 18, BLUE, True)
    slide.line(1450, 327, 1450, 435, TEAL, 3)
    slide.text("QUERY TIME", 62, 439, 1100, 38, 14, TEAL, True)
    for label, horizontal in [("Question", 62), ("Top-five\nretrieval", 430), ("phi3:mini\ngeneration", 798), ("Answer +\nsource context", 1166)]:
        slide.node(label, horizontal, 500, 302, 106, WHITE, NAVY)
        if horizontal < 1166:
            slide.arrow(horizontal + 302, 526, width=66)
    slide.text("Chunk index", 1245, 431, 290, 48, 18, TEAL, True, "center")
    slide.line(1245, 455, 581, 455, TEAL, 3)
    slide.arrow(554, 455, "down", width=54)
    slide.text("Core scope: document segmentation, context attachment and controlled comparison.", 64, 665, 1470, 49, 20, NAVY, True)
    slide.band("Not evaluated here: a separate evidence-sufficiency or secondary-retrieval controller.", size=16)
    slide.notes = "Explain v as local semantic displacement, a as change in that displacement, and sigma as local variability. The same profile is reused for representation decisions. Encoder revision and index backend are not confirmed in the supplied experiment record, so do not name a particular encoder or vector database as measured fact. Context ON/OFF is an ablation, not a second retrieval stage."

    slide = Slide("Functional requirements trace directly to the title", "Relevance of project requirement specification | 5 marks")
    rows = [
        ("FR1", "Semantic transition profiles", "Compute v, a, σ and structural features.", "Deterministic feature output", "O1"),
        ("FR2", "Adaptive chunking", "Apply boundary rules within chunk bounds.", "No invalid / out-of-range spans", "O1"),
        ("FR3", "Selective context", "Enable / disable relevant historical attachment.", "Paired context OFF / ON runs", "O2"),
        ("FR4", "Retrieval + generation", "Retrieve evidence and generate an answer.", "Source-linked retrieval records", "O3"),
        ("FR5", "Empirical evaluation", "Export metrics, settings and predictions.", "Complete per-run output record", "O3–O4"),
    ]
    table(slide, ["ID", "Title term", "Functional requirement", "Acceptance evidence", "Goal"], rows, 62, 178, [92, 280, 480, 480, 144], 98, 16)
    slide.band("Each requirement has an identifier, an observable behavior and a verification artifact.", size=16)
    slide.notes = "Treat this as the proposed project requirement specification, not an assertion that all tests have passed. This table supports title relevance and makes the objectives testable. Do not use vague requirements such as 'the system should be accurate' without defining a measurement."

    slide = Slide("Quality requirements: define how success is checked", "Quality of project requirement specification | 5 marks")
    rows = [
        ("Reproducibility", "Freeze data splits and parameters; retain seeds and model settings.", "Manifest, checksum and saved outputs"),
        ("Evaluation fairness", "Use the same task setting; report all six arms and unfavorable results.", "Comparable configurations and full tables"),
        ("Efficiency", "Measure build, retrieval and generation separately; track chunk count.", "Timing boundaries, hardware and token budgets"),
        ("Traceability", "Map retrieved and appended evidence back to source units.", "Document IDs, offsets and provenance records"),
        ("Reporting integrity", "Separate descriptive gains from verified statistical conclusions.", "Paired predictions and documented inference"),
    ]
    table(slide, ["Quality attribute", "Requirement", "Verification artifact"], rows, 62, 178, [275, 732, 469], 98, 16)
    slide.band("Acceptance criteria are specified here; aggregate results alone do not verify every criterion.", size=16)
    slide.notes = "Explain one example: a retrieval time without hardware, caching conditions and timing boundaries is not a portable performance guarantee. For the final SRS, assign requirement IDs, priority, dependencies and agreed numeric resource ceilings after measuring available hardware. Do not invent latency targets or sample counts."

    slide = Slide("Feasibility: what is supported, what remains uncertain", "Level of analysis of feasibility | 5 marks")
    feasibility = [
        ("Technical", "Reported runs use local phi3:mini. Aggregate metrics exist for 36 runs.", "Still needed: executable code, model revisions and raw logs."),
        ("Operational", "A flat chunk-index pipeline supports component-level comparison.", "Still needed: ingestion / retrieval demo and provenance inspection."),
        ("Economic", "Local compute is a design option; there is no verified cost estimate.", "Still needed: hardware capacity, storage and runtime budget."),
        ("Schedule", "Next work can be divided into logging, verification and evaluation tasks.", "Still needed: owners and dates approved with the guide."),
    ]
    for index, (heading, evidence, gap) in enumerate(feasibility):
        horizontal = 62 + (index % 2) * 753
        vertical = 170 + (index // 2) * 278
        slide.card(horizontal, vertical, 723, 252, heading, evidence, BLUE, 18)
        slide.text(gap, horizontal + 24, vertical + 176, 669, 76, 15, RED)
    slide.band("Feasibility is conditional and evidence-based—not proof of large-scale deployment readiness.", size=16)
    slide.notes = "The supplied walkthrough reports completed implementation, calibration and tests, but their code and logs were not provided with the paper materials. Present this distinction confidently. Economic feasibility must be measured; local inference does not mean zero cost. Schedule feasibility needs actual dates agreed by the team and guide."

    slide = Slide("Constraints and mitigations—not unsupported promises", "Relevant constraints | economic, environmental, safety and sustainability | 5 marks")
    constraints = [
        ("Compute / cost", "More chunks and context can increase storage and runtime.", "Set and measure corpus, chunk and prompt budgets."),
        ("Environment", "Embedding, indexing and generation consume compute resources.", "Reuse valid caches; measure resource use before claiming savings."),
        ("Safety / reliability", "Relevant retrieval does not guarantee a supported answer.", "Retain source evidence and inspect unsupported-answer cases."),
        ("Data / privacy", "Access conditions and confidential inputs constrain corpus use.", "Record dataset provenance; avoid unapproved sensitive material."),
        ("Sustainability", "Model and configuration changes can break comparability.", "Version artifacts and maintain reproducible baselines."),
    ]
    table(slide, ["Constraint", "Project impact", "Mitigation / measurement"], constraints, 62, 178, [260, 630, 586], 98, 16)
    slide.band("No measured monetary cost, energy saving or safety certification is claimed.", size=16)
    slide.notes = "Map these directly to the rubric's economic, environmental, safety and sustainability examples. Environmental statements are design considerations, not measured energy results. Grounding is a proposed safeguard, not a guarantee that generated answers are correct."

    slide = Slide("Validation plan: isolate components rather than add everything", "Feasibility and requirement verification", "Study design and run count: supplied implementation walkthrough. Dataset sources: Yang et al., 2018; Dasigi et al., 2021.")
    slide.node("HotpotQA\n+ QASPER", 62, 181, 304, 94)
    slide.arrow(370, 203, width=60)
    slide.node("Development-only\ncalibration", 433, 181, 304, 94)
    slide.arrow(744, 203, width=60)
    slide.node("Freeze splits\n+ parameters", 806, 181, 304, 94)
    slide.arrow(1116, 203, width=60)
    slide.node("Three seeds\n42 / 123 / 999", 1184, 181, 354, 94)
    slide.text("SIX COMPARISON ARMS", 62, 335, 1460, 43, 15, TEAL, True)
    labels = ["Fixed-size", "Similarity\nthreshold", "Velocity\nonly", "Velocity +\nacceleration", "Full STP", "STP +\ncontext"]
    for index, label in enumerate(labels):
        slide.node(label, 62 + index * 249, 398, 230, 107, PALE if index >= 2 else WHITE)
    slide.card(62, 557, 714, 156, "Retrieval and answers", "Recall@5 • MRR • EM • F1", TEAL, 20)
    slide.card(800, 557, 738, 156, "Structure and cost", "Chunks/doc. • build time • retrieval latency", BLUE, 19)
    slide.band("6 arms × 3 seeds × 2 datasets = 36 reported runs. Raw-run verification remains open.", size=16)
    slide.notes = "Show how each arm answers an objective. Full STP versus velocity-only is not a clean structure-only or volatility-only test; those isolated controls are still absent. Dataset sample counts, retrieval setting and metric mappings must be supplied before making benchmark-wide claims."

    slide = Slide("Preliminary evidence: context helps one dataset, hurts another", "Feasibility evidence | not a universal performance claim", "Source: supplied aggregate tables; means across three seeds. Four selected arms shown; all six appear in backup slide 15.")
    selected = ["Fixed-size", "Velocity-only", "Full STP", "Full STP + selective context"]
    colors = [MUTED, BLUE, TEAL, ORANGE]
    labels = ["Fixed", "Velocity", "STP", "STP + ctx"]
    for dataset, origin in [("HotpotQA", 93), ("QASPER", 864)]:
        slide.text(dataset, origin, 164, 600, 55, 24, TEAL, True)
        plot_left, plot_top, plot_width, plot_height = origin + 48, 249, 560, 312
        for tick in [0.0, 0.1, 0.2, 0.3, 0.4]:
            vertical = plot_top + plot_height - tick / 0.45 * plot_height
            slide.line(plot_left, vertical, plot_left + plot_width, vertical, BORDER, 1)
            slide.text(f"{tick:.1f}", origin - 10, vertical - 12, 48, 35, 12, MUTED, align="right")
        for index, (method, color, label) in enumerate(zip(selected, colors, labels)):
            value = float(results[(dataset, method)]["f1_mean"])
            height = value / 0.45 * plot_height
            horizontal = plot_left + 18 + index * 139
            slide.rect(horizontal, plot_top + plot_height - height, 91, height, color, radius=0)
            slide.text(f"{value:.3f}", horizontal - 13, plot_top + plot_height - height - 38, 120, 36, 17, color, True, "center")
            slide.text(label, horizontal - 19, plot_top + plot_height + 19, 135, 54, 14, NAVY, False, "center")
        slide.text("Answer F1 | identical vertical scale", origin + 50, 221, 570, 29, 12, MUTED)
    slide.card(62, 653, 719, 132, "HotpotQA", "STP + context: +0.066 F1 vs velocity-only.", TEAL, 18)
    slide.card(808, 653, 730, 132, "QASPER", "Fixed-size leads; context drops F1 by 0.037.", RED, 18)
    slide.notes = "These are reported aggregate means, not rerun results. HotpotQA F1 increases from 0.344 to 0.410 versus velocity-only; against STP without context the gain is 0.127. QASPER F1 drops from 0.105 to 0.068 with context, and fixed-size is best overall in the supplied table. This is why feasibility and novelty should not be defended using a universal superiority claim. No significance or energy/cost claim follows from this figure."

    slide = Slide("Responsibilities must be backed by actual artifacts", "Fulfillment of responsibilities | 5 marks")
    slide.text("PROPOSED allocation only—confirm with the team before presenting as actual contributions.", 63, 162, 1468, 68, 18, RED, True)
    rows = [
        ("Mohammad Sameer\n(proposed)", "Data preparation and provenance", "Split manifest, unit extraction, source mapping, preprocessing checks"),
        ("Rajeev Kumar Gupta\n(proposed)", "STP and selective context", "Feature tests, segmentation code, calibration file, context examples"),
        ("Mohit Dev Tomar\n(proposed)", "Evaluation and reporting", "Run logs, metric scripts, ablation tables, figures and error analysis"),
    ]
    table(slide, ["Owner to confirm", "Workstream", "Evidence to show"], rows, 62, 259, [377, 399, 700], 114, 17)
    slide.text("All members: cross-review requirements, reproduce at least one run, rehearse and answer questions.", 83, 690, 1440, 80, 19, TEAL, True)
    slide.notes = "Actual individual contributions were not supplied. The slide intentionally labels this as a proposal; replace it with an accurate allocation, commit history, logbook entries and guide-reviewed work before evaluation. Do not present proposed tasks as completed contributions. If the responsibilities differ, edit this slide."

    slide = Slide("Milestones: reported progress vs verified evidence", "Feasibility, accountability and guide review")
    steps = [
        ("1  Reported", "Implementation, dev calibration and 36 runs are described in the walkthrough.", BLUE),
        ("2  Available", "The manuscript, aggregate result tables and result diagrams are available.", TEAL),
        ("3  Verify next", "Obtain manifests, configurations, code, test logs and paired predictions.", ORANGE),
        ("4  Review", "Audit metrics and uncertainty; agree responsibilities and dates with the guide.", NAVY),
    ]
    for index, (heading, body, color) in enumerate(steps):
        slide.card(62 + index * 376, 209, 350, 360, heading, body, color, 19)
    slide.text("Before evaluation", 65, 619, 1450, 47, 24, TEAL, True)
    slide.text("Confirm the guide's name, presentation duration, real task owners and a dated evidence log.", 65, 677, 1460, 100, 22)
    slide.notes = "Do not invent milestone completion dates or a guide endorsement. The walkthrough reports seventeen passing tests, but the test log is not among the supplied materials. Bring the actual test output if it exists. Use a dated logbook and an agreed schedule to demonstrate responsibility and readiness."

    slide = Slide("Evaluation 1 takeaway", "Summary and discussion")
    slide.card(62, 175, 1476, 151, "A specific, testable project", "Transition-guided chunking and context, evaluated against simple baselines.", TEAL, 21)
    slide.card(62, 351, 1476, 151, "Evidence supports a bounded claim", "Mixed results: context helps HotpotQA but reduces QASPER answer F1.", BLUE, 21)
    slide.card(62, 527, 1476, 151, "Next commitment", "Make the experiment record auditable and close the requirement-verification gaps.", ORANGE, 21)
    slide.band("Guide feedback sought: scope • acceptance criteria • responsibilities • realistic milestones", size=17)
    slide.notes = "Close with what has been specified, what the preliminary data show, and what remains to be verified. Invite guide feedback on the requirement specification and feasibility constraints, rather than merely asking whether the result number is good. Use the two backup slides only if needed."

    slide = Slide("Backup: all six ablation arms", "Q&A backup | complete comparison", "Source: supplied HotpotQA and QASPER aggregate results. Rounded means only; three reported seeds.")
    rows = []
    for method in METHODS:
        hotpot = results[("HotpotQA", method)]
        qasper = results[("QASPER", method)]
        label = method.replace("Full STP + selective context", "STP + context")
        rows.append((label, hotpot["recall_mean"], hotpot["f1_mean"], qasper["recall_mean"], qasper["f1_mean"]))
    table(slide, ["Method", "Hotpot R@5", "Hotpot F1", "QASPER R@5", "QASPER F1"], rows, 62, 190, [484, 248, 248, 248, 248], 75, 17)
    slide.band("No claim of statistical significance: paired predictions and bootstrap details still require verification.", size=15)
    slide.notes = "Use this table to avoid selective reporting. Higher recall is not the same as a better answer. Full STP does not reduce QASPER chunk count: it creates more chunks than velocity-only. If asked about p-values or the very narrow reported confidence intervals, state that the underlying bootstrap record must be audited."

    slide = Slide("Backup: sources and evidence boundaries", "Written communication | references", "Bibliographic details are taken from the unchanged manuscript and references.bib.")
    sources = [
        ("[1] Lewis et al. (2020)", "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks. NeurIPS 33, 9459–9474."),
        ("[2] Chen et al. (2024)", "Dense X Retrieval: What Retrieval Granularity Should We Use? EMNLP, 15159–15177."),
        ("[3] Yang et al. (2018)", "HotpotQA: A Dataset for Diverse, Explainable Multi-hop Question Answering. EMNLP, 2369–2380."),
        ("[4] Dasigi et al. (2021)", "A Dataset of Information-Seeking Questions and Answers Anchored in Research Papers. NAACL, 4599–4610."),
    ]
    for index, (heading, body) in enumerate(sources):
        vertical = 169 + index * 119
        slide.text(heading, 65, vertical, 1470, 40, 18, TEAL, True)
        slide.text(body, 65, vertical + 43, 1460, 69, 16)
    slide.text("Project evidence: supplied implementation walkthrough and aggregate tables.\nNot independently checked here: code execution, test logs, split sizes and statistical inference.", 65, 678, 1460, 114, 17, RED)
    slide.notes = "These references are reused from the manuscript, not newly reviewed literature for this deck. If asked for reproducibility, show actual experiment artifacts rather than treating the paper or these slides as evidence that code has been rerun. The teacher's rubric is the source of the presentation structure."


def xml_text(shape, identifier):
    paragraphs = []
    for line in shape["lines"]:
        properties = f'sz="{round(shape["size"] * 100)}" b="{int(shape["bold"])}" lang="en-US"'
        alignment = {"left": "l", "center": "ctr", "right": "r"}[shape["align"]]
        paragraphs.append(f'<a:p><a:pPr algn="{alignment}"><a:lnSpc><a:spcPct val="120000"/></a:lnSpc><a:spcAft><a:spcPts val="0"/></a:spcAft></a:pPr><a:r><a:rPr {properties}><a:solidFill><a:srgbClr val="{shape["color"]}"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>{escape(line)}</a:t></a:r><a:endParaRPr {properties}/></a:p>')
    return f'<p:sp><p:nvSpPr><p:cNvPr id="{identifier}" name="Text {identifier}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>{transform(shape)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>{"".join(paragraphs)}</p:txBody></p:sp>'


def transform(shape):
    return f'<a:xfrm><a:off x="{round(shape["x"] * EMU)}" y="{round(shape["y"] * EMU)}"/><a:ext cx="{round(shape["w"] * EMU)}" cy="{round(shape["h"] * EMU)}"/></a:xfrm>'


def xml_shape(shape, identifier):
    if shape["kind"] == "text":
        return xml_text(shape, identifier)
    if shape["kind"] == "line":
        left, top = min(shape["x"], shape["x2"]), min(shape["y"], shape["y2"])
        width, height = abs(shape["x2"] - shape["x"]), abs(shape["y2"] - shape["y"])
        flip_h = ' flipH="1"' if shape["x2"] < shape["x"] else ""
        flip_v = ' flipV="1"' if shape["y2"] < shape["y"] else ""
        return f'<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="{identifier}" name="Line {identifier}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm{flip_h}{flip_v}><a:off x="{round(left * EMU)}" y="{round(top * EMU)}"/><a:ext cx="{round(width * EMU)}" cy="{round(height * EMU)}"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="{round(shape["width"] * EMU)}"><a:solidFill><a:srgbClr val="{shape["color"]}"/></a:solidFill></a:ln></p:spPr></p:cxnSp>'
    geometry = "roundRect" if shape["radius"] else "rect"
    outline = f'<a:solidFill><a:srgbClr val="{shape["stroke"]}"/></a:solidFill>' if shape["stroke"] else '<a:noFill/>'
    return f'<p:sp><p:nvSpPr><p:cNvPr id="{identifier}" name="Shape {identifier}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>{transform(shape)}<a:prstGeom prst="{geometry}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="{shape["fill"]}"/></a:solidFill><a:ln w="12700">{outline}</a:ln></p:spPr></p:sp>'


NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
GROUP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
MAPPING = '<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>'


def relationships(items):
    rows = ''.join(f'<Relationship Id="{identifier}" Type="{kind}" Target="{target}"/>' for identifier, kind, target in items)
    return f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{rows}</Relationships>'


def theme_xml():
    colors = [("dk1", NAVY), ("lt1", WHITE), ("dk2", MUTED), ("lt2", PAPER), ("accent1", TEAL), ("accent2", BLUE), ("accent3", ORANGE), ("accent4", RED), ("accent5", "7A64A2"), ("accent6", "839A58"), ("hlink", BLUE), ("folHlink", "7A64A2")]
    scheme = ''.join(f'<a:{name}><a:srgbClr val="{color}"/></a:{name}>' for name, color in colors)
    font_scheme = ''.join(f'<a:{name}><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:{name}>' for name in ['majorFont', 'minorFont'])
    fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
    lines = ''.join(f'<a:ln w="{width}" cap="flat" cmpd="sng" algn="ctr">{fill}<a:prstDash val="solid"/></a:ln>' for width in [6350, 12700, 19050])
    return f'<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="STP-RAG"><a:themeElements><a:clrScheme name="STP-RAG">{scheme}</a:clrScheme><a:fontScheme name="Arial">{font_scheme}</a:fontScheme><a:fmtScheme name="STP-RAG"><a:fillStyleLst>{fill * 3}</a:fillStyleLst><a:lnStyleLst>{lines}</a:lnStyleLst><a:effectStyleLst>{"<a:effectStyle><a:effectLst/></a:effectStyle>" * 3}</a:effectStyleLst><a:bgFillStyleLst>{fill * 3}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>'


def write_pptx(path):
    prefix = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
    parts = {}
    parts['_rels/.rels'] = relationships([('rId1', prefix + 'officeDocument', 'ppt/presentation.xml'), ('rId2', 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml'), ('rId3', prefix + 'extended-properties', 'docProps/app.xml')])
    identifiers = ''.join(f'<p:sldId id="{255 + index}" r:id="rId{index + 1}"/>' for index in range(1, len(SLIDES) + 1))
    parts['ppt/presentation.xml'] = f'<p:presentation {NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>{identifiers}</p:sldIdLst><p:sldSz cx="{WIDTH * EMU}" cy="{HEIGHT * EMU}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle></p:presentation>'
    parts['ppt/_rels/presentation.xml.rels'] = relationships([('rId1', prefix + 'slideMaster', 'slideMasters/slideMaster1.xml')] + [(f'rId{index + 1}', prefix + 'slide', f'slides/slide{index}.xml') for index in range(1, len(SLIDES) + 1)])
    parts['ppt/slideMasters/slideMaster1.xml'] = f'<p:sldMaster {NS}><p:cSld><p:spTree>{GROUP}</p:spTree></p:cSld>{MAPPING}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>'
    parts['ppt/slideMasters/_rels/slideMaster1.xml.rels'] = relationships([('rId1', prefix + 'slideLayout', '../slideLayouts/slideLayout1.xml'), ('rId2', prefix + 'theme', '../theme/theme1.xml')])
    parts['ppt/slideLayouts/slideLayout1.xml'] = f'<p:sldLayout {NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>{GROUP}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'
    parts['ppt/slideLayouts/_rels/slideLayout1.xml.rels'] = relationships([('rId1', prefix + 'slideMaster', '../slideMasters/slideMaster1.xml')])
    parts['ppt/theme/theme1.xml'] = theme_xml()
    for index, slide in enumerate(SLIDES, 1):
        shapes = ''.join(xml_shape(shape, identifier) for identifier, shape in enumerate(slide.shapes, 2))
        parts[f'ppt/slides/slide{index}.xml'] = f'<p:sld {NS}><p:cSld name="{escape(slide.title, {chr(34): "&quot;"})}"><p:bg><p:bgPr><a:solidFill><a:srgbClr val="{slide.background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>{GROUP}{shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
        parts[f'ppt/slides/_rels/slide{index}.xml.rels'] = relationships([('rId1', prefix + 'slideLayout', '../slideLayouts/slideLayout1.xml')])
    parts['docProps/core.xml'] = '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>STP-RAG Evaluation 1</dc:title><dc:creator>STP-RAG project team</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">2026-09-15T00:00:00Z</dcterms:created></cp:coreProperties>'
    parts['docProps/app.xml'] = f'<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>STP-RAG Presentation Builder</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>{len(SLIDES)}</Slides></Properties>'
    overrides = [('/ppt/presentation.xml', 'presentationml.presentation.main'), ('/ppt/slideMasters/slideMaster1.xml', 'presentationml.slideMaster'), ('/ppt/slideLayouts/slideLayout1.xml', 'presentationml.slideLayout'), ('/ppt/theme/theme1.xml', 'theme')]
    overrides += [(f'/ppt/slides/slide{index}.xml', 'presentationml.slide') for index in range(1, len(SLIDES) + 1)]
    types = ''.join(f'<Override PartName="{name}" ContentType="application/vnd.openxmlformats-officedocument.{kind}+xml"/>' for name, kind in overrides)
    parts['[Content_Types].xml'] = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' + types + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'
    with ZipFile(path, 'w', ZIP_DEFLATED) as archive:
        for filename, content in parts.items():
            ET.fromstring(content)
            archive.writestr(filename, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + content)
    with ZipFile(path) as archive:
        names = set(archive.namelist())
        assert archive.testzip() is None
        for filename in names:
            if filename.endswith('.rels'):
                base = '' if filename == '_rels/.rels' else posixpath.dirname(posixpath.dirname(filename))
                for relation in ET.fromstring(archive.read(filename)):
                    resolved = posixpath.normpath(posixpath.join(base, relation.attrib['Target']))
                    assert resolved in names, (filename, resolved)


def main():
    ROOT.mkdir(exist_ok=True)
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    protected = [Path('archive/v1_paper/STP_RAG_Research_Paper_Revised.tex'), Path('archive/v1_paper/STP_RAG_Research_Paper_Revised.pdf'), Path('archive/v1_paper/references.bib'), Path('archive/v1_paper/MANUSCRIPT_NOTES.md')] + list(Path('archive/v1_paper/results').rglob('*'))
    before = {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in protected if path.is_file()}
    results = read_results()
    build_slides(results)
    assert len(SLIDES) == 16
    if WARNINGS:
        raise ValueError('\n'.join(WARNINGS))
    write_pptx(ROOT / 'STP_RAG_Evaluation_1.pptx')
    images = [slide.image for slide in SLIDES]
    images[0].save(ROOT / 'STP_RAG_Evaluation_1_Preview.pdf', save_all=True, append_images=images[1:], resolution=120)
    contact = Image.new('RGB', (4 * 400, 4 * 248), '#D9E2EA')
    for index, slide in enumerate(SLIDES):
        slide.image.save(PREVIEWS / f'slide-{index + 1:02d}.png')
        thumbnail = ImageOps.contain(slide.image, (392, 220))
        left, top = (index % 4) * 400 + 4, (index // 4) * 248 + 24
        contact.paste(thumbnail, (left, top))
        ImageDraw.Draw(contact).text((left, top - 21), f'{index + 1:02d}. {slide.title[:43]}', fill='#' + NAVY)
    contact.save(PREVIEWS / 'contact.png')
    notes = ['# STP-RAG Evaluation 1 — speaker notes', '', 'Core presentation: slides 1–14. Slides 15–16 are Q&A backups. Suggested total: 10–12 minutes, subject to the actual evaluation time limit.', '']
    for index, slide in enumerate(SLIDES, 1):
        notes.extend([f'## Slide {index}: {slide.title}', '', f'Rubric focus: {slide.category}.', '', slide.notes, ''])
    (ROOT / 'SPEAKER_NOTES.md').write_text('\n'.join(notes))
    (ROOT / 'slide_content.json').write_text(json.dumps([dict(title=slide.title, category=slide.category, shapes=slide.shapes, notes=slide.notes) for slide in SLIDES], ensure_ascii=False, indent=2))
    after = {filename: hashlib.sha256(Path(filename).read_bytes()).hexdigest() for filename in before}
    assert before == after, 'Protected paper files changed.'
    (ROOT / 'paper_integrity.json').write_text(json.dumps(dict(unchanged=True, sha256=after), indent=2))
    print(f'Created {len(SLIDES)} editable slides, a PDF design preview, and speaker notes. Protected paper files are unchanged.')


if __name__ == '__main__':
    main()