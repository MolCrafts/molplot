"""Render the Vega-Lite intermediate specs to matplotlib and assert the
translator drew the expected artists."""

import matplotlib.pyplot as plt

import molplot


def teardown_function():
    plt.close("all")


def test_render_line_draws_one_line_per_series():
    spec = molplot.line_spec(
        [
            {"id": "a", "x": [0, 1, 2], "y": [1, 3, 2]},
            {"id": "b", "x": [0, 1, 2], "y": [2, 1, 4]},
        ]
    )
    # The builder attaches web-only pan/zoom params; the paper renderer must
    # ignore them and draw the initial view.
    assert molplot.specs.zoom_params_of(spec)
    fig, ax = molplot.render(spec)
    assert len(ax.lines) == 2


def test_render_scatter_draws_a_collection():
    spec = molplot.scatter_spec([0, 1, 2], [0, 1, 4])
    fig, ax = molplot.render(spec)
    assert len(ax.collections) >= 1


def test_render_bar_grouped():
    spec = molplot.bar_spec(
        ["q1", "q2"],
        [{"id": "ok", "values": [3, 5]}, {"id": "fail", "values": [1, 2]}],
        mode_="group",
    )
    fig, ax = molplot.render(spec)
    assert len(ax.patches) == 4  # 2 series x 2 categories


def test_render_gantt_numeric_time():
    spec = molplot.gantt_spec(
        [
            {"id": "t1", "label": "Build", "start": 0, "end": 5, "status": "ok"},
            {"id": "t2", "label": "Test", "start": 5, "end": 9, "status": "ok"},
        ],
        {"ok": "#22c55e"},
    )
    fig, ax = molplot.render(spec)
    assert len(ax.patches) == 2


def test_render_applies_preset_colour():
    spec = molplot.line_spec([{"id": "a", "label": "A", "color": "#123456", "x": [0, 1], "y": [0, 1]}])
    fig, ax = molplot.render(spec)
    # matplotlib normalises hex to lowercase rgba; compare via to_hex.
    from matplotlib.colors import to_hex

    assert to_hex(ax.lines[0].get_color()) == "#123456"
