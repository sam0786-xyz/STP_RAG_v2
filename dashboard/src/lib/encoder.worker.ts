/**
 * Runs BAAI/bge-small-en-v1.5 in the browser (transformers.js, ONNX, fp16) off the main thread.
 * The fp16 weights reproduce the fastembed similarities used for the precomputed samples to about
 * 0.001 (checked on all four samples when this was written). CLS pooling + L2 norm, as fastembed does.
 */
import type { FeatureExtractionPipeline } from "@huggingface/transformers";

export const MODEL_ID = "Xenova/bge-small-en-v1.5";
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

type In =
  | { type: "load"; localModels: string | null; localWasm: string | null }
  | { type: "embed"; id: number; texts: string[]; query: boolean };

let extractor: FeatureExtractionPipeline | null = null;

const post = (m: unknown) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (ev: MessageEvent<In>) => {
  const msg = ev.data;
  try {
    if (msg.type === "load") {
      const { pipeline, env } = await import("@huggingface/transformers");
      if (msg.localModels) {
        env.allowLocalModels = true;
        env.localModelPath = msg.localModels;
      } else env.allowLocalModels = false;
      if (msg.localWasm && env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = msg.localWasm;
      if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
      // typed loosely: the pipeline() overloads are too large for the checker to resolve
      const make = pipeline as unknown as (task: string, model: string, opts: object) => Promise<FeatureExtractionPipeline>;
      extractor = (await make("feature-extraction", MODEL_ID, {
        dtype: "fp16",
        device: "wasm",
        progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (p.status === "progress" && p.file && p.total) {
            post({ type: "progress", file: p.file, loaded: p.loaded, total: p.total });
          }
        },
      })) as FeatureExtractionPipeline;
      post({ type: "ready", source: msg.localModels ? "local" : "remote" });
    } else if (msg.type === "embed") {
      if (!extractor) throw new Error("model not loaded");
      const out: number[][] = [];
      const batch = 16;
      for (let i = 0; i < msg.texts.length; i += batch) {
        const part = msg.texts.slice(i, i + batch).map((t) => (msg.query ? QUERY_PREFIX + t : t));
        const t = await extractor(part, { pooling: "cls", normalize: true });
        out.push(...(t.tolist() as number[][]));
        post({ type: "embed-progress", id: msg.id, done: Math.min(msg.texts.length, i + batch), total: msg.texts.length });
      }
      post({ type: "embedded", id: msg.id, vectors: out });
    }
  } catch (e) {
    post({ type: "error", id: "id" in msg ? msg.id : undefined, message: e instanceof Error ? e.message : String(e) });
  }
};
