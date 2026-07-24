import path from "node:path";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

// The example bundles @molcrafts/molplot from source (not dist), so edits to
// the Web Component hot-reload without publishing or rebuilding the package.
export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: { index: "./src/index.tsx" },
    alias: {
      "@molcrafts/molplot": path.resolve(
        import.meta.dirname,
        "../core/src/index.ts",
      ),
    },
  },
  dev: {
    watchFiles: [{ paths: [path.resolve(import.meta.dirname, "../core/src")] }],
  },
  server: { port: 3000 },
  html: { title: "MolPlot Web Component Example" },
});
