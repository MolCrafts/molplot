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
├── presets/            # design tokens (single source of truth) + JSON schema
├── schema/             # editor contract (Scene / Command / Engine)
├── scripts/            # build-presets.mjs, build-schema.mjs
├── core/               # @molcrafts/molplot — Vega-Lite charts + VegaEngine (TS)
├── page/               # figure workbench (React; `molplot serve` / npm run dev)
├── examples/           # themed examples: web/ playground, figures/ scripts
├── python/             # molcrafts-molplot — matplotlib + MatplotlibEngine + host
├── tests/fixtures/     # shared editor fixtures (TS + Python)
└── docs/               # zensical sources (build output is gitignored `site/`)
```

## Quick start

**Web (TypeScript)** — `npm install @molcrafts/molplot`

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
pip install -e './python[dev]'
npm run build:presets    # regenerate preset artifacts from presets/*.json
npm run build:schema     # regenerate editor types from schema/editor/model.json
npm run build:docs-assets # compile <molplot-chart> from core/ → docs/assets/molplot
npm run docs             # documentation site (source-built Web Component, not CDN)
npm run dev              # figure workbench at localhost:3001 (proxy /api → :8765)
npm run example:web      # Web Component playground at localhost:3000
npm run example:kinetics # figure workbench (`examples/figures/kinetics.py`)
npm run typecheck        # core + page + examples/web
npm test                 # core + page (rstest) + python (pytest)
npm run lint             # biome
```

The generated preset files (`core/src/presets/generated.ts`,
`python/src/molplot/presets/*`) are committed and guarded in CI — run
`npm run build:presets` after editing any `presets/*.json` and commit the result.

## Documentation

Full manual: [docs.molcrafts.org/molplot](https://docs.molcrafts.org/molplot/)
(sources in [`docs/`](docs/)). Live `<molplot-chart>` charts and `molplot`
fenced blocks on that site are compiled from `core/`
(`npm run build:docs-assets`), not loaded from a CDN.

- [Getting started](https://docs.molcrafts.org/molplot/getting-started/)
- [Unified preset](https://docs.molcrafts.org/molplot/getting-started/preset/)
- [Web](https://docs.molcrafts.org/molplot/getting-started/web/)
- [Python](https://docs.molcrafts.org/molplot/getting-started/python/)
- [Markdown](https://docs.molcrafts.org/molplot/getting-started/markdown/)
- [Workbench](https://docs.molcrafts.org/molplot/getting-started/workbench/)
- [API reference](https://docs.molcrafts.org/molplot/api/)

```bash
# local preview — compiles core/dist/elements.js then serves docs
pip install "zensical>=0.0.53" "molcrafts-zensical-theme>=0.3.0"
npm run docs
```

## License

BSD-3-Clause
