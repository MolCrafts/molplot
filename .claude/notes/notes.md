# Notes

Evolving design decisions. Newest first.

## 2026-09-21 — Workbench presets are a host extra

Left-rail Preset tab lists Figure script, MolPlot, scienceplots, seaborn,
and Custom (curated matplotlib rc). scienceplots and seaborn are optional:
the host probes `import`, and the UI disables the source with
`pip install …` when missing. Applying a style reloads the figure script
after `rc_file_defaults()` so new artists pick up the overlay. Not Core
Scene; still POST `/api/commands`.

## 2026-09-19 — Formal workbench is `page/`, chrome from molcrafts-ui

The figure editor is a React workbench in `page/`, framed by
`WorkbenchShell`. Product slots: data/elements left rail, SVG canvas,
inspector. Host (`molplot serve`) serves `host/dist` when built, else
the legacy static prototype. Examples are themed: `examples/web/` and
`examples/figures/`.

## 2026-09-18 — Editor stack is additive; Vega-Lite is construction IR

Two jobs: (1) construct a chart as a Vega-Lite spec for web + paper;
(2) edit live backend objects through Scene / Command / Engine.
Vega is one Engine, not the Scene. MatplotlibEngine is Python;
VegaEngine is TypeScript. Editability is Engine runtime truth.
Override / script-replay is not Core vocabulary in v0.
