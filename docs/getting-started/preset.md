# Preset

A browser chart and a matplotlib figure each pick fonts and colours on their
own, so “the same plot” is two restyles. The preset is the shared token file
both sides compile from: palette, type scale, grid, light and dark.

Two names ship. `molplot` is the default. `molplot-paper` is tighter, for a
single journal column — same colours, smaller type and markers, higher DPI.

```python
molplot.use("molplot")
molplot.use("molplot-paper")
```

On the web, pass the same name as `preset`. Dark mode is `mode="dark"` in
Python and `theme="dark"` (or `"auto"`) on the web.

| | `molplot` | `molplot-paper` |
|--|-----------|-----------------|
| For | screen | single-column print |
| scienceplots base | `science` | `science` + `nature` |
| Type (base / title / tick) | 10 / 12 / 9 | 9 / 10 / 8 |
| Marker | 6 | 3 |
| Figure / DPI | 3.5 × 2.625 in / 400 | 3.3 × 2.5 in / 600 |

Both use Times and the scienceplots seven-colour cycle (`#0c5da5` …). To
change those, edit `presets/<name>.json` and run `npm run build:presets`.
Commit the generated files — CI fails if they drift.
