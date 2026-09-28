import path from "node:path";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

const root = import.meta.dirname;
const pythonDev = process.env.MOLPLOT_PYTHON_DEV === "1";
const distRoot = pythonDev
  ? path.join("..", "python", "src", "molplot", "host", "dist")
  : "dist";

export default defineConfig({
  plugins: [pluginReact()],
  html: {
    template: "./public/index.html",
  },
  server: {
    port: 3001,
    proxy: {
      "/api": "http://127.0.0.1:8765",
    },
  },
  output: {
    assetPrefix: "/",
    distPath: {
      root: distRoot,
      js: "js",
      jsAsync: "js/async",
      css: "css",
      cssAsync: "css/async",
    },
    cleanDistPath: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
      "@molcrafts/molplot/semantic": path.resolve(
        root,
        "../core/src/semantic/generated.ts",
      ),
    },
  },
});
