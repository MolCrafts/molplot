# Architecture

Editor v0 lives next to the existing charting product, not inside it.

- Construction: `core/src/specs.ts` ↔ `python/src/molplot/specs.py` (Vega-Lite).
- Editor contract: `schema/editor/model.json` → generated TS + Python types.
- Engines: `core/src/engines/vega/` (TS), `python/src/molplot/engines/matplotlib/` (Python).
- Core/semantic layers must not import a backend.
- `@molcrafts/molplot` public chart API is unchanged; Engine is not re-exported.
- Figure workbench lives in `page/`, not in `core` and not in `examples/`.
  Chrome is `WorkbenchShell` / `IconButton` / `PanelTabStrip` copied from
  molcrafts-ui (MolVis 0.3.0 layout engine: overlay rails, snap-close,
  1280/1580 drawers). The page talks to the Python host over `/api/result`,
  `/api/commands`, `/api/export/{fmt}`. It imports generated Scene types
  only — never Engine. Workbench presets are a host extra on that same
  surface (`style` on the result payload; `{type: style}` on `/api/commands`),
  not Core Scene and not a new HTTP API. scienceplots and seaborn are
  optional — missing packages are listed as unavailable with an install hint.
  scienceplots `science` enables matplotlib usetex; if `type1cm.sty` is missing
  (TeX Live basic), the host layers `no-latex` and Custom TeX stays disabled.
- `examples/web/` is the Web Component playground (`npm run example:web`).
  `examples/figures/` holds matplotlib scripts (`npm run example:kinetics`).
  Docs sources are `docs/`; `site/` and `docs/assets/` are generated and
  gitignored. Live `<molplot-chart>` on the docs site is the `elements`
  bundle compiled from `core/` (`npm run build:docs-assets`); `zensical.toml`
  must not load the npm CDN. The host serves `page` via `host/dist`
  (`npm run build:page`); `host/static/index.html` is only a not-built stub.
