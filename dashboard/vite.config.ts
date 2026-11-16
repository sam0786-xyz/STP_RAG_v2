import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" so the built site works from any folder or static host.
// The encoder worker lazy-loads transformers.js, which needs ES-module workers.
export default defineConfig({
  plugins: [react()],
  base: "./",
  worker: { format: "es" },
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
});
