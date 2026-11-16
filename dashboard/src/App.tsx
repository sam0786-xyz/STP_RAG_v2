import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import type { Demo, Pilot, RunBundle } from "./lib/types";
import type { Doc, PlaygroundData } from "./lib/doc";
import { fromPaper, fromSample, fromText, sentenceSims } from "./lib/doc";
import type { Settings, StpModel } from "./lib/chunkers";
import { embed, useEncoder } from "./lib/encoder";
import type { RouteId } from "./lib/route";
import { ROUTES, readHash, replaceHash, settingsFromParams, settingsToParams } from "./lib/route";
import PlaygroundPage from "./pages/PlaygroundPage";
import TryItPage from "./pages/TryItPage";
import ExplorePage from "./pages/ExplorePage";
import EvidencePage from "./pages/EvidencePage";
import HelpGuide from "./components/HelpGuide";
import Tour, { TOUR } from "./components/Tour";
import { Drawer } from "./components/ui";

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };

function useJson<T>(url: string): Load<T> {
  const [s, set] = useState<Load<T>>({ state: "loading" });
  useEffect(() => {
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${url} returned HTTP ${r.status}`);
        return r.json();
      })
      .then((data: T) => set({ state: "ready", data }))
      .catch((e: Error) => set({ state: "error", message: e.message }));
  }, [url]);
  return s;
}

const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage unavailable: this only loses a convenience */
    }
  },
};

export default function App() {
  const [{ route, params, nav }, setLoc] = useState(() => ({ ...readHash(), nav: 0 }));
  const demo = useJson<Demo>("./data/demo.json");
  const pilot = useJson<Pilot>("./data/pilot.json");
  const play = useJson<PlaygroundData>("./data/playground.json");
  const [bundle, setBundle] = useState<RunBundle | null>(null);
  const [help, setHelp] = useState(false);
  const [seen, setSeen] = useState(() => store.get("stp-guide-seen") === "1");
  const [tour, setTour] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>(() => settingsFromParams(readHash().params));
  const [customText, setCustomText] = useState(() => store.get("stp-custom-text") ?? "");
  const [customDoc, setCustomDoc] = useState<Doc | null>(() => (customText.trim() ? fromText(customText) : null));
  const enc = useEncoder();

  // a hashchange is a navigation (link, tour, back button); pages remount and re-read their parameters
  useEffect(() => {
    const on = () => {
      const h = readHash();
      setLoc((l) => ({ ...h, nav: l.nav + 1 }));
      setSettings(settingsFromParams(h.params));
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  // carry the chunking settings across pages (a tour step's address has none, so it starts from defaults)
  const go = (r: RouteId) => {
    const qs = new URLSearchParams(settingsToParams(settings)).toString();
    window.location.hash = `/${r}${qs ? `?${qs}` : ""}`;
    window.scrollTo({ top: 0 });
  };

  // pages report their own state; settings ride along so any address reproduces the view
  const sync = useCallback(
    (p: Record<string, string | undefined | false>) => replaceHash(route, { ...p, ...settingsToParams(settings) }),
    [route, settings],
  );

  const applyCustom = (text: string) => {
    setCustomText(text);
    store.set("stp-custom-text", text);
    setCustomDoc(text.trim() ? fromText(text) : null);
  };

  // once the model is loaded, give pasted text its sentence similarities
  useEffect(() => {
    if (enc.status !== "ready" || !customDoc || customDoc.sims) return;
    let live = true;
    embed(customDoc.sentences.map((s) => s.text)).then((e) => live && setCustomDoc({ ...customDoc, sims: sentenceSims(e) }));
    return () => {
      live = false;
    };
  }, [enc.status, customDoc]);

  const openHelp = () => {
    setHelp(true);
    setSeen(true);
    store.set("stp-guide-seen", "1");
  };
  const tourTo = (k: number) => {
    setTour(k);
    window.location.hash = TOUR[k].hash;
    window.scrollTo({ top: 0 });
  };
  const startTour = () => {
    setHelp(false);
    setSeen(true);
    store.set("stp-guide-seen", "1");
    tourTo(0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName) || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") openHelp();
      const n = Number(e.key);
      if (n >= 1 && n <= ROUTES.length) go(ROUTES[n - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const model = useMemo<StpModel | null>(
    () => (play.state === "ready" ? { window: play.data.window, weights: play.data.weights, scalers: play.data.scalers } : null),
    [play],
  );
  const samples = useMemo(() => (play.state === "ready" ? play.data.samples.map(fromSample) : []), [play]);
  const paper = useMemo(() => (demo.state === "ready" ? fromPaper(demo.data) : null), [demo]);

  const failed = [demo, pilot, play].find((x) => x.state === "error") as { message: string } | undefined;
  const ready = demo.state === "ready" && pilot.state === "ready" && play.state === "ready" && model && paper;
  const idx = ROUTES.findIndex((r) => r.id === route);

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            {[9, 15, 7, 18, 11, 22].map((h, i) => (
              <span key={i} style={{ height: h, background: i === 5 ? "var(--accent)" : undefined }} />
            ))}
          </div>
          <div className="brand-name">STP-RAG Workbench</div>
        </div>
        <nav className="nav" aria-label="Pages">
          {ROUTES.map((r, i) => (
            <button key={r.id} aria-current={route === r.id ? "page" : undefined} onClick={() => go(r.id)}>
              {route === r.id && (
                <motion.span layoutId="nav-ind" className="nav-indicator" transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} />
              )}
              <span className="nav-step">{i + 1}</span>
              <span className="nav-text">
                <span className="nav-label">{r.label}</span>
                <span className="nav-sub">{r.sub}</span>
              </span>
            </button>
          ))}
        </nav>
        <div className="rail-actions">
          <button className="btn help-btn" onClick={startTour} disabled={!ready}>▶ Guided tour</button>
          <button className="btn help-btn" onClick={openHelp} disabled={!ready}>
            <span className="help-q" aria-hidden="true">?</span> How to use
          </button>
        </div>
        <div className="rail-foot">
          Sameer, Gupta, Tomar, Raj, Nand, Astya
          <br />
          Sharda University
        </div>
      </aside>

      <main className="main" id="content">
        {failed ? (
          <div className="page">
            <div className="note" role="alert">
              <strong>Data did not load.</strong> {failed.message}. Start the site with <code>npm run dev</code> or{" "}
              <code>npm run preview</code>; browsers block data files opened straight from disk.
            </div>
          </div>
        ) : !ready ? (
          <div className="page muted" aria-busy="true">Loading data…</div>
        ) : (
          <div className="page" key={`${route}-${nav}`}>
            {!seen && tour === null && (
              <div className="welcome">
                <span>New here? The guided tour takes two minutes and works well for presenting.</span>
                <button className="btn btn-primary btn-small" onClick={startTour}>Start the tour</button>
                <button className="btn btn-small" onClick={openHelp}>Read the guide</button>
                <button className="btn btn-small" onClick={() => { setSeen(true); store.set("stp-guide-seen", "1"); }}>Dismiss</button>
              </div>
            )}
            {route === "play" && (
              <PlaygroundPage samples={samples} settings={settings} onSettings={setSettings} model={model} params={params} sync={sync}
                custom={{ text: customText, doc: customDoc, apply: applyCustom }} />
            )}
            {route === "try" && (
              <TryItPage samples={samples} paper={paper} custom={customDoc} settings={settings} model={model} params={params} sync={sync}
                goPlay={() => { window.location.hash = "/play?s=custom"; }} />
            )}
            {route === "how" && <ExplorePage demo={demo.data} />}
            {route === "evidence" && <EvidencePage pilot={pilot.data} bundle={bundle} onBundle={setBundle} params={params} sync={sync} />}
            <footer className="page-foot">
              <span>Step {idx + 1} of {ROUTES.length}</span>
              {idx < ROUTES.length - 1 && (
                <button className="btn" onClick={() => go(ROUTES[idx + 1].id)}>Next: {ROUTES[idx + 1].label}</button>
              )}
            </footer>
          </div>
        )}
      </main>

      {ready && (
        <Drawer open={help} onClose={() => setHelp(false)} title="How to use" wide>
          <HelpGuide demo={demo.data} onGo={(r) => { setHelp(false); go(r as RouteId); }} onTour={startTour} />
        </Drawer>
      )}
      <Tour step={tour} onStep={tourTo} onClose={() => setTour(null)} />
    </div>
  );
}
