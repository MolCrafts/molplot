"""The Python spec builders must produce the same Vega-Lite shapes as the
TypeScript ones (core/src/specs.ts) — that structural equivalence is what makes
the spec a portable interchange format."""

import molplot


def test_line_spec_shape_and_config():
    spec = molplot.line_spec(
        [{"id": "a", "label": "A", "x": [0, 1], "y": [1, 2]}],
        show_legend=True,
    )
    assert spec["$schema"].endswith("vega-lite/v5.json")
    assert spec["data"]["values"][0] == {"s": "a", "key": "A", "i": 0, "x": 0, "y": 1}
    # Unified preset injected as the VL config.
    assert spec["config"]["range"]["category"][0] == "#0c5da5"
    color = spec["layer"][0]["encoding"]["color"]
    assert color["scale"]["domain"] == ["A"]
    assert color["legend"] == {"title": None}


def test_scatter_spec_numeric_colour_uses_scheme():
    spec = molplot.scatter_spec([0, 1], [0, 1], color=[1.0, 2.0], colorscale="magma", show_scale=True)
    color = spec["encoding"]["color"]
    assert color["type"] == "quantitative"
    assert color["scale"]["scheme"] == "magma"


def test_bar_spec_group_offset_and_stack():
    grouped = molplot.bar_spec(["a", "b"], [{"id": "s", "values": [1, 2]}], mode_="group")
    assert grouped["encoding"]["xOffset"] == {"field": "key"}
    assert grouped["encoding"]["y"]["stack"] is None
    stacked = molplot.bar_spec(["a"], [{"id": "s", "values": [1]}], mode_="stack")
    assert stacked["encoding"]["y"]["stack"] is True


def test_bar_spec_horizontal_flips_channels():
    spec = molplot.bar_spec(["a"], [{"id": "s", "values": [1]}], orientation="h")
    assert spec["encoding"]["y"]["field"] == "cat"
    assert spec["encoding"]["x"]["field"] == "val"


def test_gantt_spec_spans_and_status_colours():
    spec = molplot.gantt_spec(
        [{"id": "t", "label": "Build", "start": 0, "end": 10, "status": "ok"}],
        {"ok": "#22c55e"},
    )
    assert spec["encoding"]["x"]["field"] == "start"
    assert spec["encoding"]["x2"]["field"] == "end"
    assert spec["encoding"]["color"]["scale"]["range"] == ["#22c55e"]


def test_vega_config_matches_preset_palette():
    cfg = molplot.vega_config("molplot")
    assert cfg["range"]["category"][0] == "#0c5da5"
    assert cfg["axis"]["grid"] is True


from molplot.specs import ZOOM_EVENT_FLAG, ZOOM_PARAM, zoom_params_of


def _marks_of(spec):
    """Every mark in the spec tree, layered or unit. Mirrors `marksOf` in
    core/tests/specs.test.ts."""
    return [layer["mark"] for layer in spec["layer"]] if "layer" in spec else [spec["mark"]]


def _channels(spec):
    return [p["select"]["encodings"][0] for p in zoom_params_of(spec)]


def _all_specs():
    return {
        "line": molplot.line_spec([{"id": "a", "x": [0, 1], "y": [1, 2]}]),
        "scatter": molplot.scatter_spec([0, 1], [0, 1]),
        "bar": molplot.bar_spec(["a"], [{"id": "s", "values": [1]}]),
        "gantt": molplot.gantt_spec([{"id": "t", "label": "L", "start": 0, "end": 1, "status": "ok"}], {"ok": "#22c55e"}),
    }


def test_every_chart_declares_one_scale_bound_param_per_zoomable_axis():
    """The interaction is part of the portable spec, so the TS and Python
    builders must emit it identically (see core/tests/specs.test.ts)."""
    for spec in _all_specs().values():
        for param in zoom_params_of(spec):
            channel = param["select"]["encodings"][0]
            assert param["name"] == ZOOM_PARAM[channel]
            assert param["bind"] == "scales"
            assert param["select"]["type"] == "interval"
            # One param per scale is what lets an axis-gutter wheel zoom one axis.
            assert len(param["select"]["encodings"]) == 1
            # `view:` reaches the axes (they render pointer-events: none, outside
            # the plot group); the shift clause keeps the spec self-sufficient.
            flag = ZOOM_EVENT_FLAG[channel]
            assert param["select"]["zoom"] == f"view:wheel![event.{flag} || event.shiftKey]"


def test_only_continuous_channels_are_bound():
    specs = _all_specs()
    assert _channels(specs["line"]) == ["x", "y"]
    assert _channels(specs["scatter"]) == ["x", "y"]
    # The remaining axis of each is a band scale, which cannot take a binding.
    assert _channels(specs["bar"]) == ["y"]
    assert _channels(specs["gantt"]) == ["x"]
    horizontal = molplot.bar_spec(["a"], [{"id": "s", "values": [1]}], orientation="h")
    assert _channels(horizontal) == ["x"]


def test_marks_are_clipped_to_the_plot_rect():
    """Without clip a zoomed-in mark paints over the axes."""
    for spec in _all_specs().values():
        assert all(mark["clip"] is True for mark in _marks_of(spec))
