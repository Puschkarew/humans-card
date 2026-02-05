import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "HumansViewer",
      formats: ["iife"],
      fileName: () => "humans-viewer.js"
    },
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
