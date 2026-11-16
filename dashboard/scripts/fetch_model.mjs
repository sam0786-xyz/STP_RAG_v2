// Optional: keep a local copy of the in-browser encoder so the dashboard works offline
// (for example, when presenting without Wi-Fi). Without this, the browser downloads the model
// from huggingface.co the first time you press "Load the model" and caches it.
//
//   node scripts/fetch_model.mjs
//
// Writes public/models/Xenova/bge-small-en-v1.5/ (about 65 MB), which the dashboard picks up
// automatically. The ONNX Runtime WebAssembly file is already bundled by `npm run build`.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = "Xenova/bge-small-en-v1.5";
const files = ["config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "onnx/model_fp16.onnx"];
const out = join(root, "public", "models", repo);

for (const f of files) {
  const dest = join(out, f);
  if (existsSync(dest)) {
    console.log(`have ${f}`);
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  const url = `https://huggingface.co/${repo}/resolve/main/${f}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  console.log(`got  ${f}`);
}

console.log("Done. The dashboard will now load the model from this folder.");
