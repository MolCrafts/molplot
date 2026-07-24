---
mol_project:
  name: molplot
  stage: experimental
  language: mixed
  build:
    install: npm install && pip install -e './python[dev]'
    check: npm run check:presets && npx biome check && npm run typecheck
    test: npm test
    test_single: pytest {path} -v
    coverage: "cd python && pytest --cov=molplot tests"
  arch:
    style: monorepo
    rules_section: "Critical invariants"
  doc:
    style: jsdoc-tiered
  science:
    required: false
  ci:
    config: .github/workflows/ci.yml
    local: "npm run check:presets && npx biome check && npm run typecheck && npm test"
  notes_path: .claude/notes/notes.md
  specs_path: .claude/specs/
---

# CLAUDE.md

## What this repo is

MolPlot — unified scientific charting for the MolCrafts stack. One **unified
preset** and one **Vega-Lite intermediate language** drive two renderers:

- **Web** — `@molcrafts/molplot` (TypeScript, `core/`): imperative chart classes
  that build a Vega-Lite spec and render it via `vega-embed`.
- **Paper** — `molcrafts-molplot` (Python, `python/`): wraps **scienceplots**,
  injects the same preset into matplotlib `rcParams`, and renders the *same
  Vega-Lite spec* to a figure.

Split out of `molvis` (was a plotly sub-package) into a standalone repo, re-based
on Vega-Lite so a single spec is portable between the browser and matplotlib.

## Where things live

| What | Where |
|------|-------|
| Canonical preset tokens (single source of truth) | `presets/*.json` + `presets/preset.schema.json` |
| Preset compiler | `scripts/build-presets.mjs` |
| TS chart engine | `core/src/` |
| TS tests | `core/tests/` |
| Web Component example | `example/src/` |
| Python package | `python/src/molplot/` |
| Python tests | `python/tests/` |
| Docs | `docs/` |

## Build & test

```bash
npm install
npm run build:presets    # regenerate generated preset artifacts from presets/*.json
npm run dev              # Web Component example at localhost:3000
npm run build:core       # rslib → core/dist (npm publish artifact)
npm run typecheck        # core + example
npm test                 # core (rstest, node) + python (pytest)
npm run lint             # biome check --write
cd python && pytest      # python only
```

## Monorepo structure

npm workspaces: `["core", "example"]`. `python/` is a separate hatchling package
(not an npm workspace). `example/` bundles `@molcrafts/molplot` from **source** via
an rsbuild alias; each package's `dist/` is for publish only.

| Package | Path | Purpose |
|---------|------|---------|
| `@molcrafts/molplot` | `core/` | Vega-Lite chart classes + spec builders + theme |
| `example` | `example/` | React 19 Web Component playground |
| `molcrafts-molplot` (PyPI) | `python/` | scienceplots wrapper + VL→matplotlib renderer |

## Critical invariants

- **The preset is a single source of truth.** `presets/*.json` is the ONLY
  hand-edited copy. `scripts/build-presets.mjs` compiles it to
  `core/src/presets/generated.ts` (typed const), `python/src/molplot/presets/_generated.py`
  (dict), and `python/src/molplot/presets/*.mplstyle`. Never hand-edit a
  generated file. CI runs `npm run check:presets` (a `git diff` drift guard) —
  after editing a preset, run `npm run build:presets` and commit the output.

- **Vega-Lite is the intermediate language.** Chart definitions live in pure
  spec builders — `core/src/specs.ts` (TS) and `molplot/specs.py` (Python) —
  which MUST produce structurally identical specs (same field names `s`/`key`/
  `cat`/`val`/…, same encoding shape). That equivalence is what lets a spec
  render in the browser *and* in matplotlib. Keep the two in lockstep; a spec
  change on one side needs the mirror on the other.

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

**Python (`python/src/molplot/`)**
- `preset.py` — tokens → `rcParams`; `style.py` — `use()` / `style()` compose
  scienceplots base + overlay, and register the `.mplstyle` files.
- `specs.py` — Vega-Lite spec builders (mirror of `specs.ts`, self-contained
  inline data).
- `render.py` — VL→matplotlib translator (line/scatter/bar/gantt).
- `charts.py` — one-call `line`/`scatter`/`bar`/`gantt` (spec + render).
- `convert.py` — optional exact web-parity export via `vl-convert`.

## Release

Tag `v*` fires two workflows: `release-core.yml` (npm OIDC Trusted Publisher,
Node 24, `npm publish -w core --provenance`) and `release-python.yml` (build the
wheel after `npm run build:presets`, publish to PyPI via OIDC). Both re-run the
preset drift check first. Fork/upstream convention mirrors the other MolCrafts
repos: origin = `Roy-Kid/molplot`, upstream = `MolCrafts/molplot`; integrate on
`dev`, release from `master`.
