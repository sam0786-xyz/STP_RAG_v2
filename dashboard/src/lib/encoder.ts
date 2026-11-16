/**
 * Main-thread handle on the in-browser encoder. One worker for the whole app; a small store so any
 * component can show the model's state; a cache so the same text is never embedded twice.
 */
import { useSyncExternalStore } from "react";

export type EncoderState =
  | { status: "idle" }
  | { status: "loading"; loaded: number; total: number }
  | { status: "ready"; source: "local" | "remote" }
  | { status: "error"; message: string };

let state: EncoderState = { status: "idle" };
const listeners = new Set<() => void>();
const set = (s: EncoderState) => {
  state = s;
  listeners.forEach((l) => l());
};

let worker: Worker | null = null;
let readyPromise: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: number[][]) => void; reject: (e: Error) => void }>();
const cache = new Map<string, number[]>();

/** Use model files under ./models when scripts/fetch_model.mjs has put them there. */
async function localPaths(): Promise<{ models: string | null; wasm: string | null }> {
  const base = new URL("./", window.location.href).href;
  const isJson = async (u: string) => {
    try {
      const r = await fetch(u, { method: "GET", cache: "no-store" });
      return r.ok && (r.headers.get("content-type") ?? "").includes("json");
    } catch {
      return false;
    }
  };
  const models = (await isJson(`${base}models/Xenova/bge-small-en-v1.5/config.json`)) ? `${base}models/` : null;
  return { models, wasm: null };
}

export function loadEncoder(): Promise<void> {
  if (readyPromise) return readyPromise;
  set({ status: "loading", loaded: 0, total: 0 });
  readyPromise = new Promise<void>((resolve, reject) => {
    worker = new Worker(new URL("./encoder.worker.ts", import.meta.url), { type: "module" });
    const files = new Map<string, { loaded: number; total: number }>();
    worker.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === "progress") {
        files.set(m.file, { loaded: m.loaded, total: m.total });
        let loaded = 0;
        let total = 0;
        files.forEach((f) => {
          loaded += f.loaded;
          total += f.total;
        });
        set({ status: "loading", loaded, total });
      } else if (m.type === "ready") {
        set({ status: "ready", source: m.source });
        resolve();
      } else if (m.type === "embedded") {
        pending.get(m.id)?.resolve(m.vectors);
        pending.delete(m.id);
      } else if (m.type === "error") {
        if (m.id != null && pending.has(m.id)) {
          pending.get(m.id)!.reject(new Error(m.message));
          pending.delete(m.id);
        } else {
          set({ status: "error", message: m.message });
          readyPromise = null;
          worker?.terminate();
          worker = null;
          reject(new Error(m.message));
        }
      }
    };
    localPaths().then(({ models, wasm }) => worker!.postMessage({ type: "load", localModels: models, localWasm: wasm }));
  });
  return readyPromise;
}

/** Embed texts (passages, or queries with the bge instruction prefix). Cached per text. */
export async function embed(texts: string[], query = false): Promise<number[][]> {
  await loadEncoder();
  const key = (t: string) => `${query ? "q" : "p"}\u0000${t}`;
  const missing = [...new Set(texts.filter((t) => !cache.has(key(t))))];
  if (missing.length) {
    const id = nextId++;
    const vecs = await new Promise<number[][]>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker!.postMessage({ type: "embed", id, texts: missing, query });
    });
    missing.forEach((t, i) => cache.set(key(t), vecs[i]));
  }
  return texts.map((t) => cache.get(key(t))!);
}

export function useEncoder(): EncoderState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
