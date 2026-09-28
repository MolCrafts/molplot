---
mol_project:
  name: molplot
  stage: experimental
  language: mixed
  build:
    install: npm install && pip install -e './python[dev]'
    check: npm run check:presets && npm run check:schema && npm run check:biome && npm run typecheck
    test: npm test
    test_single: pytest {path} -v
    coverage: "cd python && pytest --cov=molplot tests"
  dev:
    command: npm run dev:page
    ready_pattern: "Local:"
    url_pattern: "(http://localhost:\\d+)"
  arch:
    style: monorepo
    rules_section: "Critical invariants"
  doc:
    style: jsdoc-tiered
  science:
    required: false
  ci:
    config: .github/workflows/ci.yml
    local: "npm run check:presets && npm run check:schema && npm run check:biome && npm run typecheck && npm test"
  notes_path: .claude/notes/notes.md
  specs_path: .claude/specs/
---

# CLAUDE.md

## What this repo is

MolPlot — unified scientific charting for the MolCrafts stack. Two jobs share
one preset and must not be confused:

- **Construction** — describe a chart once as a Vega-Lite spec
  (`core/src/specs.ts` / `molplot/specs.py`) and render it on the web
  (`vega-embed`) or on paper (matplotlib + scienceplots).
- **Editing** — reflect a live backend into a backend-neutral Scene, apply
  Commands, re-render. MatplotlibEngine is Python; VegaEngine is TypeScript.
  Vega is one Engine, not the Scene.

Split out of `molvis` (was a plotly sub-package) into a standalone repo.

## Where things live

| What | Where |
|------|-------|
| Canonical preset tokens (single source of truth) | `presets/*.json` + `presets/preset.schema.json` |
| Preset compiler | `scripts/build-presets.mjs` |
| Editor contract (single source of truth) | `schema/editor/model.json` |
| Editor schema compiler | `scripts/build-schema.mjs` |
| TS chart engine | `core/src/` |
| TS editor types / VegaEngine | `core/src/semantic/`, `core/src/engines/vega/` |
| TS tests | `core/tests/` |
| Workbench tests | `page/tests/` |
| Figure workbench | `page/` (served by `molplot serve`) |
| Examples | `examples/web/` (playground) and `examples/figures/` (`molplot serve`) |
| Python package | `python/src/molplot/` |
| Python editor types / MatplotlibEngine | `python/src/molplot/semantic/`, `python/src/molplot/engines/matplotlib/` |
| Python tests | `python/tests/` |
| Shared editor fixtures | `tests/fixtures/editor/` |
| Docs | `docs/` (live `<molplot-chart>` is compiled from `core/`, not CDN) |

## Build & test

```bash
npm install
npm run build:presets    # regenerate generated preset artifacts from presets/*.json
npm run build:schema     # regenerate editor types from schema/editor/model.json
npm run dev              # Figure workbench at localhost:3001 (proxy /api → :8765)
npm run example:web      # Web Component playground at localhost:3000
npm run build:core       # rslib → core/dist (npm publish artifact)
npm run build:page       # workbench into python/src/molplot/host/dist
npm run build:docs-assets # elements bundle → docs/assets/molplot (gitignored)
npm run docs             # zensical serve with the source-built Web Component
npm run docs:build       # static site/ (same local bundle, no CDN)
npm run typecheck        # core + page + examples/web
npm test                 # core + page (rstest) + python (pytest)
npm run lint             # biome check --write
cd python && pytest      # python only
npm run example:kinetics                      # workbench at http://127.0.0.1:8765
```

## Monorepo structure

npm workspaces: `["core", "examples/web", "page"]`. `python/` is a separate hatchling package
(not an npm workspace). `examples/web` bundles `@molcrafts/molplot` from **source**
via an rsbuild alias. `examples/figures` holds matplotlib scripts for
`molplot serve`. `page/` is the figure workbench (molcrafts-ui `WorkbenchShell`).
Each package's `dist/` is for publish only.

| Package | Path | Purpose |
|---------|------|---------|
| `@molcrafts/molplot` | `core/` | Vega-Lite chart classes + spec builders + theme |
| `examples-web` | `examples/web/` | React 19 Web Component playground |
| `page` | `page/` | Figure workbench (`molplot serve`) |
| `molcrafts-molplot` (PyPI) | `python/` | scienceplots wrapper + VL→matplotlib renderer |

## Critical invariants

- **The preset is a single source of truth.** `presets/*.json` is the ONLY
  hand-edited copy. `scripts/build-presets.mjs` compiles it to
  `core/src/presets/generated.ts` (typed const), `python/src/molplot/presets/_generated.py`
  (dict), and `python/src/molplot/presets/*.mplstyle`. Never hand-edit a
  generated file. CI runs `npm run check:presets` (a `git diff` drift guard) —
  after editing a preset, run `npm run build:presets` and commit the output.

- **Vega-Lite is the construction intermediate language.** Chart definitions
  live in pure spec builders — `core/src/specs.ts` (TS) and `molplot/specs.py`
  (Python) — which MUST produce structurally identical specs (same field names
  `s`/`key`/`cat`/`val`/…, same encoding shape). Keep the two in lockstep; a
  spec change on one side needs the mirror on the other. This is how a chart
  is *built* for web and paper. It is not the editor Scene.

- **The editor contract is backend-neutral.** Vocabulary is Scene / Node /
  Component / Role / Command / Engine / RenderResult. `schema/editor/model.json`
  is the only hand-edited copy; `scripts/build-schema.mjs` emits
  `core/src/semantic/generated.ts` and `python/src/molplot/semantic/_generated.py`.
  Never hand-edit those. CI runs `npm run check:schema`. Vega is one Engine;
  Scene ≠ Vega-Lite spec ≠ Vega scenegraph ≠ Matplotlib artist tree ≠ SVG DOM.
  Editability is reported by the Engine from runtime truth, never inferred by
  Core. Adding an Engine must not change semantic types. Do not export Engine
  from `@molcrafts/molplot` or `molplot.__all__`.

- **The unified preset is injected as the renderer's native theme, never
  hardcoded.** TS: `vegaConfig(theme)` → Vega-Lite `config`. Python:
  `rc_params()` layered on the scienceplots base named by
  `preset.sciencePlotsBase`. Both read from the same tokens.

- **Preserve the npm public API.** `@molcrafts/molplot` is consumed downstream
  (e.g. molexp's UI): the chart classes (`LineChart` / `ScatterChart` /
  `BarChart` / `GanttChart` / `RawChart`), their `ready`/`resize`/`dispose`/
  `on*Click` surface, `LineChart`'s streaming methods, and every exported
  config/event type name are a contract — do not rename or remove them. The one
  intentional break vs the plotly build: `RawChart` takes a Vega-Lite `{ spec }`.

- **The Vega runtime is lazy + externalized.** `core/src/vega_loader.ts` is the
  only `import("vega-embed")`; `rslib.config.ts` externalizes vega so a consumer
  that never draws a chart never bundles it. Tests inject a fake via
  `__setVegaEmbedForTesting` and stay headless (node, no browser).

## Architecture notes

**TS core (`core/src/`)**
- `preset.ts` / `theme.ts` — resolve tokens → `ChartTheme` + `vegaConfig`.
- `specs.ts` — pure Vega-Lite spec builders (the intermediate language).
- `chart_base.ts` — `VegaChart`: embed lifecycle, streaming `view.data`,
  rAF-debounced re-embed on resize, `<html class="dark">` theme tracking,
  click→datum wiring.
- `line_chart.ts` / `scatter_chart.ts` / `bar_chart.ts` / `gantt_chart.ts` /
  `raw_chart.ts` — thin classes over base + specs, preserving the public API.
- `semantic/` — generated editor types + Engine interface (no vega import).
- `engines/vega/` — VegaEngine (Vega-Lite spec is execution authority).

**Python (`python/src/molplot/`)**
- `preset.py` — tokens → `rcParams`; `style.py` — `use()` / `style()` compose
  scienceplots base + overlay, and register the `.mplstyle` files.
- `specs.py` — Vega-Lite spec builders (mirror of `specs.ts`, self-contained
  inline data).
- `render.py` — VL→matplotlib translator (line/scatter/bar/gantt).
- `charts.py` — one-call `line`/`scatter`/`bar`/`gantt` (spec + render).
- `convert.py` — optional exact web-parity export via `vl-convert`.
- `semantic/` — generated editor types + Engine protocol (no matplotlib import).
- `engines/matplotlib/` — MatplotlibEngine (live Figure is execution authority).

## Release

Tag `v*` fires two workflows: `release-core.yml` (npm OIDC Trusted Publisher,
Node 24, `npm publish -w core --provenance`) and `release-python.yml` (build the
wheel after `npm run build:presets`, publish to PyPI via OIDC). Both re-run the
preset drift check first. Fork/upstream convention mirrors the other MolCrafts
repos: origin = `Roy-Kid/molplot`, upstream = `MolCrafts/molplot`; integrate on
`dev`, release from `master`.
