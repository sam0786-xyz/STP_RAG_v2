/** Hash routing with query parameters: #/play?s=handbook&t=stp&stp=0.5_90 */
import type { Settings } from "./chunkers";
import { DEFAULTS } from "./chunkers";

export const ROUTES = [
  { id: "play", label: "Playground", sub: "Six ways to cut a paragraph" },
  { id: "try", label: "Try it", sub: "Ask a question, see what is retrieved" },
  { id: "how", label: "How STP works", sub: "The signals behind each cut" },
  { id: "evidence", label: "Evidence", sub: "Pilot results and the next run" },
] as const;
export type RouteId = (typeof ROUTES)[number]["id"];

/** Pages of the earlier four-page layout, so old links still land somewhere sensible. */
const LEGACY: Record<string, string> = { explore: "how", ask: "try", results: "evidence", next: "evidence?tab=next" };

export function readHash(): { route: RouteId; params: URLSearchParams } {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path0, q0 = ""] = raw.split("?");
  const legacy = LEGACY[path0];
  const [path, q] = legacy ? [legacy.split("?")[0], legacy.split("?")[1] ?? q0] : [path0, q0];
  const route = (ROUTES.some((r) => r.id === path) ? path : "play") as RouteId;
  return { route, params: new URLSearchParams(q) };
}

const num = (v: string | null, lo: number, hi: number, d: number) => {
  const x = Number(v);
  return v !== null && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
};
const pair = (v: string | null) => (v ? v.split("_") : [null, null]);

export function settingsFromParams(p: URLSearchParams): Settings {
  const [ovS, ovO] = pair(p.get("ov"));
  const [stT, stM] = pair(p.get("stp"));
  const ovSize = num(ovS, 15, 150, DEFAULTS.overlap.size);
  return {
    fixed: { size: num(p.get("fixed"), 15, 150, DEFAULTS.fixed.size) },
    overlap: { size: ovSize, overlap: num(ovO, 0, Math.floor(ovSize / 2), DEFAULTS.overlap.overlap) },
    sentence: { per: num(p.get("sent"), 1, 8, DEFAULTS.sentence.per) },
    recursive: { max: num(p.get("rec"), 20, 200, DEFAULTS.recursive.max) },
    semantic: { pct: num(p.get("sem"), 5, 50, DEFAULTS.semantic.pct) },
    stp: { tau: num(stT, 0.1, 0.95, DEFAULTS.stp.tau), max: num(stM, 40, 200, DEFAULTS.stp.max) },
  };
}

export function settingsToParams(s: Settings): Record<string, string> {
  const out: Record<string, string> = {};
  const D = DEFAULTS;
  if (s.fixed.size !== D.fixed.size) out.fixed = String(s.fixed.size);
  if (s.overlap.size !== D.overlap.size || s.overlap.overlap !== D.overlap.overlap) out.ov = `${s.overlap.size}_${s.overlap.overlap}`;
  if (s.sentence.per !== D.sentence.per) out.sent = String(s.sentence.per);
  if (s.recursive.max !== D.recursive.max) out.rec = String(s.recursive.max);
  if (s.semantic.pct !== D.semantic.pct) out.sem = String(s.semantic.pct);
  if (s.stp.tau !== D.stp.tau || s.stp.max !== D.stp.max) out.stp = `${s.stp.tau}_${s.stp.max}`;
  return out;
}

/** Rewrite the address without adding a history entry or firing hashchange. */
export function replaceHash(route: RouteId, params: Record<string, string | undefined | null | false>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== false && v !== "") q.set(k, String(v));
  const qs = q.toString();
  const next = `#/${route}${qs ? `?${qs}` : ""}`;
  if (window.location.hash !== next) window.history.replaceState(null, "", next);
}
