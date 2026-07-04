"""Behavioural contract for the Vega-Lite → matplotlib interpreter that the
ad-hoc ``render.py`` prototype did not satisfy: positional scales (log / domain)
must reach the axis, and per-layer ``transform`` filters must be honoured so a
plain line chart draws no stray marker points.
"""

import matplotlib.pyplot as plt

import molplot


def teardown_function():
    plt.close("all")


def test_log_scale_reaches_the_axis():
    spec = molplot.line_spec([{"id": "a", "x": [1, 10, 100], "y": [1, 2, 3]}], x_log=True)
    _, ax = molplot.render(spec)
    assert ax.get_xscale() == "log"


def test_linear_scale_is_the_default():
    spec = molplot.line_spec([{"id": "a", "x": [1, 2, 3], "y": [1, 2, 3]}])
    _, ax = molplot.render(spec)
    assert ax.get_xscale() == "linear"


def test_scale_domain_sets_axis_limits():
    spec = molplot.line_spec([{"id": "a", "x": [0, 1, 2], "y": [0, 1, 2]}], y_domain=[0, 10])
    _, ax = molplot.render(spec)
    assert ax.get_ylim() == (0.0, 10.0)


def test_plain_line_draws_no_marker_points():
    # The line spec always carries a second point layer gated by a
    # ``transform: [{filter: {field: 'key', oneOf: []}}]``. With no
    # lines+markers series the filter matches nothing, so a faithful
    # interpreter draws zero collections.
    spec = molplot.line_spec([{"id": "a", "x": [0, 1, 2], "y": [0, 1, 2]}])
    _, ax = molplot.render(spec)
    assert len(ax.collections) == 0


def test_lines_plus_markers_draws_points():
    spec = molplot.line_spec([{"id": "a", "x": [0, 1, 2], "y": [0, 1, 2], "mode": "lines+markers"}])
    _, ax = molplot.render(spec)
    assert len(ax.lines) == 1
    assert len(ax.collections) >= 1


def test_detail_channel_splits_lines_without_extra_legend_series():
    # Two datapoints sharing a label but differing on the detail field ``s``
    # must not be merged into one polyline.
    spec = molplot.line_spec(
        [
            {"id": "run1", "label": "trial", "x": [0, 1], "y": [0, 1]},
            {"id": "run2", "label": "trial", "x": [0, 1], "y": [1, 2]},
        ]
    )
    _, ax = molplot.render(spec)
    assert len(ax.lines) == 2
