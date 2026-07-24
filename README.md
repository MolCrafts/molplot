# MolPlot

Unified scientific charting for the [MolCrafts](https://github.com/MolCrafts)
stack. One preset, one intermediate language, two renderers:

| Where | Package | Renderer |
|-------|---------|----------|
| Web / notebook / app UI | `@molcrafts/molplot` (npm) | **Vega-Lite** via `vega-embed` |
| Papers / static figures | `molcrafts-molplot` (PyPI) | **scienceplots + matplotlib** |

The two sides are bridged by the **Vega-Lite JSON spec** — a portable
intermediate language. A chart is described once as a spec; the browser renders
it with Vega, and Python renders the *same spec* to a matplotlib figure. A
single **unified preset** (`presets/*.json`) drives both: it compiles to a
Vega-Lite `config` on the web and to matplotlib `rcParams` (layered on
scienceplots) in Python, so a figure looks the same in a dashboard and in a
manuscript.

> Split out of [`molvis`](https://github.com/MolCrafts/molvis) — where it was a
> plotly-based charting sub-package — into a standalone repo, re-based on
> Vega-Lite. The npm package name and public chart API are preserved.

## Layout

```
molplot/
├── presets/            # canonical design tokens (single source of truth) + JSON schema
├── scripts/            # build-presets.mjs — compiles presets → per-package artifacts
├── core/               # @molcrafts/molplot — Vega-Lite chart classes (TypeScript)
├── example/            # Web Component example (React 19 + rsbuild)
├── python/             # molcrafts-molplot — scienceplots wrapper + VL→matplotlib
└── docs/               # zensical docs
```

## Quick start

**Web (TypeScript)**

```ts
import { LineChart } from "@molcrafts/molplot";

const chart = new LineChart(container, {
  preset: "molplot",
  series: [{ id: "e", label: "Energy", initialPoints: pts }],
});
chart.appendPoint("e", { x, y });   // cheap streaming update
```

**Python (matplotlib)**

```python
import molplot
molplot.use("molplot")                       # scienceplots + unified preset

spec = molplot.line_spec([{ "id": "e", "x": xs, "y": ys }])
fig, ax = molplot.render(spec)               # same spec → matplotlib figure
# ...or hand `spec` (JSON) to the web renderer for an identical chart.
```

## Develop

```bash
npm install
npm run build:presets    # regenerate preset artifacts from presets/*.json
npm run dev:example      # Web Component example at localhost:3000
npm run typecheck        # core + example
npm test                 # core (rstest) + python (pytest)
npm run lint             # biome
```

The generated preset files (`core/src/presets/generated.ts`,
`python/src/molplot/presets/*`) are committed and guarded in CI — run
`npm run build:presets` after editing any `presets/*.json` and commit the result.

## License

BSD-3-Clause
