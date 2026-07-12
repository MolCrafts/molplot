import { defineConfig } from "@rslib/core";

export default defineConfig({
  lib: [
    {
      format: "esm",
      bundle: false,
      dts: true,
      source: {
        entry: { index: "./src/**" },
      },
      output: {
        target: "web",
        // The Vega runtime is loaded lazily (vega_loader.ts) and stays out of
        // the bundle so a consumer that never renders a chart never pays for it.
        externals: ["vega", "vega-lite", "vega-embed"],
      },
    },
    // Self-contained browser bundle (`./elements` export). Loading it registers
    // the `<molplot-chart>` custom element, so a docs page needs only a single
    // <script type="module">. vega-embed is bundled in — but the chart still
    // reaches it through the dynamic `import("vega-embed")` in vega_loader.ts,
    // so the bundler code-splits vega into a lazy chunk: registering the element
    // is cheap; the ~350 KB runtime downloads only when a chart mounts.
    {
      format: "esm",
      bundle: true,
      dts: false,
      // rslib externalizes package `dependencies` by default; turn that off here
      // so vega/vega-lite/vega-embed are actually bundled into this artifact
      // (the dynamic import is still code-split into a lazy chunk).
      autoExternal: false,
      source: {
        entry: { elements: "./src/element_entry.ts" },
      },
      output: {
        target: "web",
      },
    },
  ],
});
