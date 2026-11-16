import { useEffect, useState } from "react";
import type { Pilot, RunBundle } from "../lib/types";
import { Segmented } from "../components/ui";
import ResultsPage from "./ResultsPage";
import NextRunPage from "./NextRunPage";

type Tab = "pilot" | "next";

export default function EvidencePage({ pilot, bundle, onBundle, params, sync }: {
  pilot: Pilot;
  bundle: RunBundle | null;
  onBundle: (b: RunBundle | null) => void;
  params: URLSearchParams;
  sync: (p: Record<string, string | undefined | false>) => void;
}) {
  const [tab, setTab] = useState<Tab>(params.get("tab") === "next" ? "next" : "pilot");
  useEffect(() => sync({ tab: tab === "next" ? "next" : undefined }), [tab, sync]);
  return (
    <>
      <div className="toolbar evidence-tabs">
        <Segmented id="evidence" label="Evidence" value={tab} onChange={setTab}
          options={[{ value: "pilot", label: "What the pilot found" }, { value: "next", label: "The next, fair run" }]} />
      </div>
      {tab === "pilot" ? <ResultsPage pilot={pilot} /> : <NextRunPage bundle={bundle} onBundle={onBundle} />}
    </>
  );
}
