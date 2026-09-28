# Python — `molcrafts-molplot`

```sh
pip install molcrafts-molplot
pip install "molcrafts-molplot[convert]"
```

Import: `molplot`. Names: `molplot.__all__`.

## Style

| Symbol | Role |
|--------|------|
| `use(name="molplot", mode="light")` | persistent scienceplots base + token overlay |
| `style(name, mode)` | context manager; restores `rcParams` on exit |
| `available()` | preset names (`molplot`, `molplot-paper`) |
| `register()` | register generated `.mplstyle` files (called on import) |
| `science_base(name)` | scienceplots style names under a preset |

`plt.style.use("molplot")` uses the overlay only. `molplot.use()` also layers
`sciencePlotsBase`.

## Preset / tokens

`get_preset(name)`, `resolve(name, mode)`, `rc_params(name, mode)`,
`vega_config(name, mode)`, `PRESET_NAMES`, `DEFAULT_PRESET`.

`mode` is `"light"` or `"dark"`.

## Palette

`palette(name)`, `cycle(name)` (alias of `palette`), `color(i, name)`,
`default_color(name)`, `sequential(name)`, `diverging(name)`.

`palette()[0]` is `#0c5da5`. Sequential / diverging names (`viridis`, `RdBu`)
are valid for both matplotlib and Vega-Lite.

## Spec builders

`line_spec`, `scatter_spec`, `bar_spec`, `gantt_spec`, `VL_SCHEMA`.

`line_spec` series items are `{id, label?, color?, x, y, width?, opacity?, mode?}`.
`bar_spec(categories, series, *, mode_="group", ...)` — grouping is `mode_`
because `mode` is light/dark. `gantt_spec` tasks use `status` (not the
TypeScript `statusGroup`).

## Render

`render(spec, preset=..., mode=..., ax=...)` → `(figure, axes)`.

One-call wrappers forward kwargs to the spec builder then `render`:

- `line(series, *, preset, mode, ax, **kwargs)`
- `scatter(x, y, *, preset, mode, ax, **kwargs)`
- `bar(categories, series, *, preset, mode, ax, **kwargs)`
- `gantt(tasks, status_colors, *, preset, mode, ax, **kwargs)`

## Exact web-parity export

Requires `vl-convert-python` (`[convert]` extra):

- `to_png(spec, path=None, *, scale=2.0) -> bytes`
- `to_svg(spec, path=None) -> str`

`render()` is matplotlib. `to_png` / `to_svg` are Vega.

CLI: `molplot serve script.py` — [workbench](../getting-started/workbench.md).
