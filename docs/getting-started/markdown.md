# Charts in Markdown

Embed a chart straight into a Markdown page by writing a **Vega-Lite spec** —
the same portable spec that is MolPlot's intermediate language. No JavaScript to
write, no bespoke config schema: the spec is exactly what
[Vega-Lite](https://vega.github.io/vega-lite/) accepts, and MolPlot injects the
unified preset (palette, type scale, grid) and light/dark theme tracking for you.

This works because the docs load the self-registering `<molplot-chart>` Web
Component (the `elements` bundle of `@molcrafts/molplot`) — see
[Enabling it](#enabling-it) below.

## The `molplot` fenced block

Write a fenced code block tagged `molplot`; its body is a Vega-Lite spec in YAML
(or JSON):

````markdown
```molplot
mark: {type: line, point: true}
data:
  values:
    - {step: 0, energy: 1.0}
    - {step: 1, energy: 0.6}
    - {step: 2, energy: 0.42}
    - {step: 3, energy: 0.31}
encoding:
  x: {field: step, type: quantitative, title: step}
  y: {field: energy, type: quantitative, title: energy}
```
````

renders live as:

```molplot
mark: {type: line, point: true}
data:
  values:
    - {step: 0, energy: 1.0}
    - {step: 1, energy: 0.6}
    - {step: 2, energy: 0.42}
    - {step: 3, energy: 0.31}
encoding:
  x: {field: step, type: quantitative, title: step}
  y: {field: energy, type: quantitative, title: energy}
```

### Options

Pass options in the fence header as **quoted** `key="value"` pairs:

| Option | Values | Default |
|--------|--------|---------|
| `preset` | `molplot`, `molplot-paper` | `molplot` |
| `theme` | `auto`, `light`, `dark` | `auto` (tracks the site's dark mode) |

````markdown
```molplot preset="molplot-paper" theme="light"
mark: bar
data:
  values:
    - {group: A, value: 4}
    - {group: B, value: 7}
    - {group: C, value: 3}
encoding:
  x: {field: group, type: nominal}
  y: {field: value, type: quantitative}
```
````

## The raw `<molplot-chart>` element

The fence is sugar for a custom element you can also write by hand — useful when
you need HTML around it. Wrap it in a `<div class="molplot">` so `md_in_html`
passes it through untouched, and put the spec in a `<script type="application/json">`
block:

```html
<div class="molplot">
<molplot-chart preset="molplot">
<script type="application/json">
{ "mark": "point",
  "data": { "values": [ {"x": 1, "y": 2}, {"x": 2, "y": 5}, {"x": 3, "y": 4} ] },
  "encoding": { "x": {"field": "x", "type": "quantitative"},
                "y": {"field": "y", "type": "quantitative"} } }
</script>
</molplot-chart>
</div>
```

<div class="molplot">
<molplot-chart preset="molplot">
<script type="application/json">
{ "mark": "point",
  "data": { "values": [ {"x": 1, "y": 2}, {"x": 2, "y": 5}, {"x": 3, "y": 4} ] },
  "encoding": { "x": {"field": "x", "type": "quantitative"},
                "y": {"field": "y", "type": "quantitative"} } }
</script>
</molplot-chart>
</div>

Attributes mirror the fence options (`preset`, `theme`), plus a `spec` attribute
holding inline JSON as a one-line alternative to the script block. The element
renders through the same [`RawChart`](web.md) the library exposes, so a spec that
carries its own `config` is respected verbatim.

## Enabling it

Two small additions to `zensical.toml` — already configured in this repo:

1. **Load the component** once for the whole site:

    ```toml
    extra_javascript = [
      "https://cdn.jsdelivr.net/npm/@molcrafts/molplot@0.1/dist/elements.js",
    ]
    ```

    Loading it registers `<molplot-chart>` cheaply; the ~350 KB Vega runtime is a
    lazy chunk that downloads only when a chart actually mounts.

2. **Register the fence** as a `pymdownx.superfences` custom fence pointing at the
   formatter shipped with the Python package (`molplot.mdx`):

    ```toml
    [[project.markdown_extensions.pymdownx.superfences.custom_fences]]
    name = "molplot"
    class = "molplot"
    format = "molplot.mdx.molplot_fence"
    validator = "molplot.mdx.molplot_validator"
    ```

    The formatter runs at build time and is a pure text transform: it turns the
    fenced Vega-Lite spec into the `<molplot-chart>` element above — it does not
    draw the chart. Because declaring `markdown_extensions` replaces Zensical's
    defaults, this repo's `zensical.toml` re-lists the full default set alongside
    this fence. The `molcrafts-molplot` package must be importable at build time
    (it is in the `doc` dependency group).
