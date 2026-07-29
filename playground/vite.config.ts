import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "its-template-editor/styles.css": path.resolve(here, "../src/styles.css"),
      "its-template-editor": path.resolve(here, "../src/index.ts"),
    },
  },
});
