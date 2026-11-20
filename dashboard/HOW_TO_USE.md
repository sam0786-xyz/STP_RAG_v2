# How to use the STP-RAG Workbench

## Start it

```bash
cd dashboard
npm install        # first time only
npm run dev        # then open http://localhost:5173
```

To share a fixed copy, run `npm run build` and serve the `dist/` folder with any static host, or use `npm run preview`. Opening `index.html` straight from disk will not work, because browsers block the data files.

## Presenting it

Press **▶ Guided tour** in the left rail. A small card in the corner walks through seven views: fixed size, recursive, STP step by step, semantic against STP, retrieval, the four signals, and the evidence. Each **Next** sets up the page for you; you only talk. Press **Load the model** on the Try it step if it has not been loaded yet.

Every view also has its own address. Copy the URL to bookmark or share exactly what is on screen.

## The four pages

The rail numbers the pages 1–4, from simplest to most technical. Each page has a **Try this** line under its title, and a **Next** button at the bottom.

### 1. Playground: six ways to cut a paragraph

Before a chatbot can search a document, the document is cut into chunks. Each coloured band in the text is one chunk.

- **Pick a text.** There are four short samples: a staff handbook, a town guide, a plant-care leaflet and a RAG explainer. Or choose **Your own text**, paste anything (blank lines between paragraphs) and press **Chunk this text**. Your text stays in your browser.
- **Pick a technique** from the six tabs:

  | Technique | How it cuts | Its slider |
  | --- | --- | --- |
  | Fixed size | every N words, even mid-sentence | chunk size |
  | Fixed + overlap | the same, but each chunk repeats the last few words of the one before | chunk size, overlap |
  | Sentences | a set number of whole sentences | sentences per chunk |
  | Recursive | at paragraph breaks, then sentences, then words, until pieces fit | largest chunk |
  | Semantic | where neighbouring sentences are least alike | share of gaps to cut |
  | STP (ours) | where the cut score from Eq. 6 is high, within size limits (Algorithm 1) | cut threshold, largest chunk |

- **Press ▶ Play.** The technique reads the text step by step and says why it cuts or keeps going at each step. For STP that includes forced cuts at the size limit (Eq. 7). Use **‹ ›** to step by hand and **Show result** to jump to the end.
- **Read the marks.** A numbered badge starts each chunk; a red **✂** badge means the cut falls inside a sentence. Click a band, or a block in the size bar above the text, to pick out one chunk and see why it starts where it does.
- **Read the bars.** Semantic and STP show one bar per gap between sentences, with a dashed cut line. Green bars are cuts; amber bars are cuts forced by the size limit. Hover a bar to underline its two sentences in the text.
- **Read the numbers** under the text: chunks, average size, sentences cut in half, and, for the samples, how many hand-marked topic changes land on a chunk edge and how many chunks mix two topics. **Show topic labels** displays the marks.
- **Compare two** puts two techniques side by side; each panel has a menu to change its technique.
- **Download chunks (JSON)** saves the current chunks with their settings.

Semantic and STP on your own text need the embedding model; the panel offers **Load the model** (about 65 MB, once). The samples work without it.

### 2. Try it: what gets retrieved

This is the retrieval step of a RAG chatbot, run in your browser.

- Press **Load the model** once. After the first time, the browser keeps it.
- Pick a document (the samples, the paper's Sections 1–3, or your pasted text) and a question, or type your own question and press **Ask**.
- Each column shows what one technique would hand the language model, best match first. The answer sentence is highlighted, and the chip says whether it was **found**, **cut in half** or **missed**. Your own questions have no marked answer, so they get no chip.
- Turn on **Same word budget for everyone**. Each technique then fills 120 words instead of sending its top two chunks, so none wins just by sending more text.
- Change a column's technique with its menu. The chunk settings are the ones from the Playground.

### 3. How STP works: the signals behind each cut

- Choose a preset (**Fewer, larger chunks**, **Balanced**, **More, smaller chunks**) or move the two sliders, and watch the green cut lines move.
- Click a block in the green strip, or anywhere on the chart, to read that chunk; **←** **→** step between chunks.
- Hover the chart to see one sentence and its velocity, acceleration, volatility and cut score.
- **Three ways to cut the same text** compares fixed size, similarity and STP on this document. **Fine-tune the signals** holds the Eq. 6 weights.

### 4. Evidence: what has been measured

- **What the pilot found**: pick HotpotQA or QASPER and a metric; click a bar for its full row; open the five reasons the numbers are not final.
- **The next, fair run**: the four hypotheses fixed in advance, and where the next experiment's results go. Build the bundle with the harness:

  ```bash
  cd stp_eval_harness
  python3 -m stp_eval.report runs/ --baseline fixed_matched \
      --metrics recall@5 mrr@10 em f1 --cluster QASPER --out run_bundle.json
  ```

  Then drag `run_bundle.json` onto the page. You get each method's difference from the baseline with 95% intervals, a table of averages, and every question's outcome. **Try with synthetic test data** shows the layout with random numbers under a red banner; never cite those.

## Keyboard

| Key | Action |
| --- | --- |
| `?` | Open the guide |
| `Esc` | Close the guide or a detail panel |
| `1`–`4` | Jump to a page |
| `←` `→` | On How STP works, move between chunks |

## What is real and what is a demo

- **Samples:** the four texts, their topic labels and their questions were written for this dashboard. The places and companies in them are fictional. The topic labels are a reading aid, not benchmark labels.
- **Encoder:** similarities come from `BAAI/bge-small-en-v1.5`. They are precomputed with fastembed for the samples and the paper, and computed in the browser (fp16 ONNX via transformers.js) for your own text and for retrieval. The two agree to about 0.001.
- **STP parameters:** the weights are hand-set demo values, the same everywhere in the app and not tuned on the samples. The scalers are fitted on the four samples plus the paper's Sections 1–3. On short texts, sentence embeddings are noisy, so neither Semantic nor STP finds every topic change.
- **Sizes** are in words on the Playground and Try it, and in tokens on How STP works (about 1.3 tokens per English word).
- **Pilot results** are the audited aggregates, unchanged. **Synthetic test data** is random.

## Offline use

Run `node scripts/fetch_model.mjs` once. It saves the model (about 65 MB) to `public/models/`, and the app then loads it from there with no internet connection. Delete that folder to go back to downloading from huggingface.co.

## Rebuilding the data

Run these from the project root:

```bash
cd paper && python3 scripts/make_results.py && cd ..   # pilot numbers (shared with the paper)
cd dashboard
python3 scripts/build_demo.py           # the paper document; needs: pip install fastembed
python3 scripts/build_playground.py     # the Playground samples (after build_demo.py)
python3 scripts/make_synthetic_bundle.py
npm test && npm run build
```
