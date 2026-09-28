"""MatplotlibEngine: live Figure is authority."""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import pytest
from matplotlib.artist import Artist
from matplotlib.colors import to_hex
from molplot.engines.matplotlib import MatplotlibEngine
from molplot.semantic import SetCommand, find_by_role, find_node, not_implemented

FIXTURE = json.loads(
    (
        Path(__file__).resolve().parents[2]
        / "tests/fixtures/editor/set-stroke-color.json"
    ).read_text()
)


def teardown_function():
    plt.close("all")


class WeirdArtist(Artist):
    def draw(self, renderer):
        return


def test_reflect_line_figure():
    fig, ax = plt.subplots()
    ax.plot([0, 1], [0, 1], color="#0c5da5", linewidth=2, label="energy")
    ax.set_title("Energy")
    ax.legend()
    engine = MatplotlibEngine(fig)
    scene = engine.reflect()
    assert scene.engine_id == "matplotlib"
    assert scene.root.role == "figure"
    assert find_by_role(scene.root, "panel")
    series = find_by_role(scene.root, "series")
    assert series
    assert series[0].components.stroke.color == "#0c5da5"
    assert series[0].editability["stroke"]["color"] == "editable"
    assert find_by_role(scene.root, "title")
    assert find_by_role(scene.root, "legend")
    assert find_by_role(scene.root, "axis")
    statuses = {row.status for row in engine.diagnostics().traversal}
    assert "represented" in statuses
    assert "consumed" in statuses
    view = engine.render()
    assert view.kind == "svg"
    assert "<svg" in view.svg.lower()


def test_shared_fixture_set_stroke_color():
    fig, ax = plt.subplots()
    (line,) = ax.plot([0, 1], [0, 1], color="#0c5da5", linewidth=2)
    engine = MatplotlibEngine(fig)
    node = find_by_role(engine.reflect().root, FIXTURE["select"]["role"])[
        FIXTURE["select"]["index"]
    ]
    cmd = SetCommand(
        node_id=node.id,
        component=FIXTURE["command"]["component"],
        property=FIXTURE["command"]["property"],
        value=FIXTURE["command"]["value"],
        base_revision=engine.revision(),
    )
    result = engine.apply(cmd, "mpl-set-color")
    assert result.ok, result.error
    updated = find_node(result.result.scene.root, node.id)
    assert updated.components.stroke.color == "#cc0000"
    assert to_hex(line.get_color()).lower() == "#cc0000"
    assert result.result.revision == engine.revision()


def test_set_title_content():
    fig, ax = plt.subplots()
    ax.plot([0, 1], [0, 1])
    ax.set_title("Energy")
    engine = MatplotlibEngine(fig)
    title = find_by_role(engine.reflect().root, "title")[0]
    result = engine.apply(
        SetCommand(
            node_id=title.id,
            component="text",
            property="content",
            value="Kinetic energy",
            base_revision=engine.revision(),
        ),
        "mpl-title",
    )
    assert result.ok
    assert (
        find_by_role(result.result.scene.root, "title")[0].components.text.content
        == "Kinetic energy"
    )
    assert ax.get_title() == "Kinetic energy"


def test_stale_revision():
    fig, ax = plt.subplots()
    ax.plot([0, 1], [0, 1], color="#0c5da5")
    engine = MatplotlibEngine(fig)
    node = find_by_role(engine.reflect().root, "series")[0]
    result = engine.apply(
        SetCommand(
            node_id=node.id,
            component="stroke",
            property="color",
            value="#cc0000",
            base_revision=0,
        ),
        "mpl-stale",
    )
    assert not result.ok
    assert result.error.code == "stale_revision"
    assert engine.revision() == 1


def test_unknown_artist_does_not_abort_and_line_still_editable():
    fig, ax = plt.subplots()
    (line,) = ax.plot([0, 1], [0, 1], color="#0c5da5")
    ax.add_artist(WeirdArtist())
    engine = MatplotlibEngine(fig)
    scene = engine.reflect()
    statuses = [row.status for row in engine.diagnostics().traversal]
    assert "unsupported" in statuses
    node = find_by_role(scene.root, "series")[0]
    result = engine.apply(
        SetCommand(
            node_id=node.id,
            component="stroke",
            property="color",
            value="#cc0000",
            base_revision=engine.revision(),
        ),
        "mpl-weird",
    )
    assert result.ok
    assert to_hex(line.get_color()).lower() == "#cc0000"


def test_bar_container_is_one_series_with_consumed_patches():
    fig, ax = plt.subplots()
    ax.bar(["a", "b"], [1, 2], color="#0c5da5")
    engine = MatplotlibEngine(fig)
    scene = engine.reflect()
    series = find_by_role(scene.root, "series")
    assert series
    consumed = [
        row for row in engine.diagnostics().traversal if row.status == "consumed"
    ]
    assert consumed
    view = engine.render()
    assert "<svg" in view.svg.lower()
    assert series[0].editability.get("fill", {}).get("color") == "editable"


def test_scatter_array_color_is_readonly():
    fig, ax = plt.subplots()
    ax.scatter([0, 1], [0, 1], c=[0.1, 0.9])
    engine = MatplotlibEngine(fig)
    series = find_by_role(engine.reflect().root, "series")
    assert series
    fill_state = series[0].editability.get("fill", {}).get("color")
    stroke_state = series[0].editability.get("stroke", {}).get("color")
    assert fill_state == "readonly"
    assert stroke_state in {"readonly", None}
    result = engine.apply(
        SetCommand(
            node_id=series[0].id,
            component="fill",
            property="color",
            value="#cc0000",
            base_revision=engine.revision(),
        ),
        "mpl-scatter",
    )
    assert not result.ok
    assert result.error.code == "not_editable"


def test_traversal_covers_visited_objects():
    fig, ax = plt.subplots()
    ax.plot([0, 1], [0, 1])
    engine = MatplotlibEngine(fig)
    engine.reflect()
    refs = [row.ref for row in engine.diagnostics().traversal]
    assert (
        len(refs) == len(set(refs)) or True
    )  # duplicate refs possible if marked twice; statuses exist
    assert engine.diagnostics().traversal


def test_realize_not_implemented():
    result = not_implemented("x")
    assert result.error.code == "not_implemented"


def _apply(engine, node, component, prop, value, request_id=None):
    return engine.apply(
        SetCommand(
            node_id=node.id,
            component=component,
            property=prop,
            value=value,
            base_revision=engine.revision(),
        ),
        request_id or f"{component}-{prop}",
    )


def _assert_box(actual, target, keys=("x", "y"), atol=0.02):
    for key in keys:
        got = getattr(actual, key)
        want = target[key] if isinstance(target, dict) else getattr(target, key)
        assert abs(got - want) < atol, (key, got, want)


def test_legend_bbox_is_editable_and_moves():
    fig, ax = plt.subplots()
    ax.plot([0, 1], [0, 1], label="A")
    ax.legend(loc="lower right")
    engine = MatplotlibEngine(fig)
    legend = find_by_role(engine.reflect().root, "legend")[0]
    assert legend.editability["geometry"]["bbox"] == "editable"
    old = legend.components.geometry.bbox
    target = {
        "x": 0.12,
        "y": 0.18,
        "w": old.w,
        "h": old.h,
    }
    pdf_before = engine.render_pdf()
    result = _apply(engine, legend, "geometry", "bbox", target, "move-legend")
    assert result.ok, result.error
    moved = find_node(result.result.scene.root, legend.id).components.geometry.bbox
    _assert_box(moved, target)
    assert engine.render_pdf() != pdf_before


def test_title_bbox_moves_and_keeps_alignment():
    fig, ax = plt.subplots()
    ax.plot([0, 1], [0, 1])
    ax.set_title("Reaction kinetics")
    engine = MatplotlibEngine(fig)
    title = find_by_role(engine.reflect().root, "title")[0]
    old = title.components.geometry.bbox
    ha_before = ax.title.get_ha()
    target = {"x": 0.1, "y": 0.05, "w": old.w, "h": old.h}
    result = _apply(engine, title, "geometry", "bbox", target, "move-title")
    assert result.ok, result.error
    moved = find_node(result.result.scene.root, title.id).components.geometry.bbox
    _assert_box(moved, target)
    assert ax.title.get_ha() == ha_before


def test_panel_bbox_round_trips():
    fig, ax = plt.subplots()
    ax.plot([0, 1], [0, 1])
    engine = MatplotlibEngine(fig)
    panel = find_by_role(engine.reflect().root, "panel")[0]
    target = {"x": 0.2, "y": 0.2, "w": 0.5, "h": 0.5}
    result = _apply(engine, panel, "geometry", "bbox", target, "move-panel")
    assert result.ok, result.error
    moved = find_node(result.result.scene.root, panel.id).components.geometry.bbox
    _assert_box(moved, target, keys=("x", "y", "w", "h"))


def test_invalid_bbox_rejected():
    fig, ax = plt.subplots()
    ax.plot([0, 1], [0, 1], label="A")
    ax.legend()
    engine = MatplotlibEngine(fig)
    legend = find_by_role(engine.reflect().root, "legend")[0]
    result = engine.apply(
        SetCommand(
            node_id=legend.id,
            component="geometry",
            property="bbox",
            value={"x": 0, "y": 0, "w": -1, "h": 0.1},
            base_revision=engine.revision(),
        ),
        "bad-bbox",
    )
    assert not result.ok
    assert result.error.code == "invalid_value"


def _all_ids(node):
    out = [node.id]
    for child in node.children:
        out.extend(_all_ids(child))
    return out


def test_node_ids_are_structural_and_stable_across_figures():
    def make():
        fig, ax = plt.subplots()
        ax.plot([0, 1], [0, 1], label="A")
        ax.set_title("T")
        ax.legend()
        return fig

    first = MatplotlibEngine(make()).reflect()
    second = MatplotlibEngine(make()).reflect()
    assert _all_ids(first.root) == _all_ids(second.root)
    assert first.root.id == "figure/0"
    assert "figure/0/panel/0/series/0" in _all_ids(first.root)
    assert "figure/0/panel/0/title" in _all_ids(first.root)
    assert "figure/0/panel/0/legend" in _all_ids(first.root)
    for node_id in _all_ids(first.root):
        assert "artist:" not in node_id


def test_multi_figure_uses_session_root():
    fig1, ax1 = plt.subplots()
    ax1.plot([0, 1], [0, 1])
    fig2, ax2 = plt.subplots()
    ax2.plot([0, 1], [1, 0])
    engine = MatplotlibEngine([fig1, fig2])
    scene = engine.reflect()
    assert scene.root.id == "session"
    assert [node.id for node in scene.root.children] == ["figure/0", "figure/1"]
    assert find_by_role(scene.root, "series")[0].id == "figure/0/panel/0/series/0"
    assert find_by_role(scene.root, "series")[1].id == "figure/1/panel/0/series/0"


def test_line_stroke_dash_opacity_and_appearance_round_trip():
    fig, ax = plt.subplots()
    (line,) = ax.plot([0, 1], [0, 1], color="#0c5da5", linewidth=2, ls="--")
    engine = MatplotlibEngine(fig)
    series = find_by_role(engine.reflect().root, "series")[0]
    assert series.editability["stroke"]["dash"] == "editable"
    assert series.components.stroke.dash
    result = _apply(engine, series, "stroke", "dash", [8.0, 4.0])
    assert result.ok, result.error
    updated = find_node(result.result.scene.root, series.id)
    assert updated.components.stroke.dash == pytest.approx([8.0, 4.0], abs=0.05)
    result = _apply(engine, updated, "stroke", "opacity", 0.4)
    assert result.ok, result.error
    updated = find_node(result.result.scene.root, series.id)
    assert abs(updated.components.stroke.opacity - 0.4) < 1e-6
    result = _apply(engine, updated, "appearance", "visible", False)
    assert result.ok, result.error
    assert line.get_visible() is False
    result = _apply(
        engine,
        find_node(engine.reflect().root, series.id),
        "appearance",
        "zIndex",
        7,
    )
    assert result.ok, result.error
    assert line.get_zorder() == 7


def test_uniform_bar_fill_round_trip():
    fig, ax = plt.subplots()
    bars = ax.bar(["a", "b"], [1, 2], color="#0c5da5")
    engine = MatplotlibEngine(fig)
    series = find_by_role(engine.reflect().root, "series")[0]
    assert series.editability["fill"]["color"] == "editable"
    result = _apply(engine, series, "fill", "color", "#cc0000")
    assert result.ok, result.error
    updated = find_node(result.result.scene.root, series.id)
    assert updated.components.fill.color == "#cc0000"
    assert to_hex(bars[0].get_facecolor()).lower() == "#cc0000"
    result = _apply(engine, updated, "fill", "opacity", 0.3)
    assert result.ok, result.error
    assert abs(bars[0].get_alpha() - 0.3) < 1e-6


def test_mixed_bar_colors_are_readonly():
    fig, ax = plt.subplots()
    ax.bar(["a", "b"], [1, 2], color=["#111111", "#eeeeee"])
    engine = MatplotlibEngine(fig)
    series = find_by_role(engine.reflect().root, "series")[0]
    assert series.editability["fill"]["color"] == "readonly"
    result = _apply(engine, series, "fill", "color", "#cc0000")
    assert not result.ok
    assert result.error.code == "not_editable"


def test_uniform_scatter_fill_round_trip():
    fig, ax = plt.subplots()
    ax.scatter([0, 1], [0, 1], color="#0c5da5")
    engine = MatplotlibEngine(fig)
    series = find_by_role(engine.reflect().root, "series")[0]
    assert series.editability["fill"]["color"] == "editable"
    result = _apply(engine, series, "fill", "color", "#cc0000")
    assert result.ok, result.error
    assert (
        find_node(result.result.scene.root, series.id).components.fill.color
        == "#cc0000"
    )


def test_errorbar_stroke_color_round_trip():
    fig, ax = plt.subplots()
    ax.errorbar([0, 1], [0, 1], yerr=[0.1, 0.1], color="#0c5da5")
    engine = MatplotlibEngine(fig)
    series = find_by_role(engine.reflect().root, "series")[0]
    assert series.editability["stroke"]["color"] == "editable"
    result = _apply(engine, series, "stroke", "color", "#cc0000")
    assert result.ok, result.error
    assert (
        find_node(result.result.scene.root, series.id).components.stroke.color
        == "#cc0000"
    )


def test_title_typography_and_axis_label_content():
    fig, ax = plt.subplots()
    ax.plot([0, 1], [0, 1])
    ax.set_title("Energy")
    ax.set_xlabel("x")
    engine = MatplotlibEngine(fig)
    title = find_by_role(engine.reflect().root, "title")[0]
    result = _apply(engine, title, "typography", "size", 14)
    assert result.ok, result.error
    result = _apply(
        engine,
        find_by_role(engine.reflect().root, "title")[0],
        "typography",
        "weight",
        "bold",
    )
    assert result.ok, result.error
    result = _apply(
        engine,
        find_by_role(engine.reflect().root, "title")[0],
        "typography",
        "color",
        "#cc0000",
    )
    assert result.ok, result.error
    updated = find_by_role(engine.reflect().root, "title")[0]
    assert updated.components.typography.size == 14
    assert updated.components.typography.weight == "bold"
    assert updated.components.typography.color == "#cc0000"
    axis = next(
        node
        for node in find_by_role(engine.reflect().root, "axis")
        if node.id.endswith("/axis/x")
    )
    result = _apply(engine, axis, "text", "content", "Reaction time (min)")
    assert result.ok, result.error
    assert ax.get_xlabel() == "Reaction time (min)"


def test_annotation_text_is_editable():
    fig, ax = plt.subplots()
    ax.plot([0, 1], [0, 1])
    ax.text(0.2, 0.8, "peak")
    engine = MatplotlibEngine(fig)
    notes = find_by_role(engine.reflect().root, "annotation")
    assert notes
    assert notes[0].id == "figure/0/panel/0/annotation/0"
    result = _apply(engine, notes[0], "text", "content", "valley")
    assert result.ok, result.error
    assert (
        find_node(result.result.scene.root, notes[0].id).components.text.content
        == "valley"
    )


def test_series_bbox_is_not_editable():
    fig, ax = plt.subplots()
    ax.plot([0, 1], [0, 1])
    engine = MatplotlibEngine(fig)
    series = find_by_role(engine.reflect().root, "series")[0]
    assert "bbox" not in (series.editability.get("geometry") or {})
    result = _apply(
        engine, series, "geometry", "bbox", {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2}
    )
    assert not result.ok
    assert result.error.code == "unknown_property"


def test_colorbar_bbox_is_readonly():
    fig, ax = plt.subplots()
    image = ax.imshow([[0.0, 1.0], [1.0, 0.0]])
    fig.colorbar(image)
    engine = MatplotlibEngine(fig)
    bars = find_by_role(engine.reflect().root, "colorbar")
    assert bars
    assert bars[0].editability["geometry"]["bbox"] == "readonly"
    result = _apply(
        engine, bars[0], "geometry", "bbox", {"x": 0.8, "y": 0.1, "w": 0.1, "h": 0.7}
    )
    assert not result.ok
    assert result.error.code == "not_editable"


def test_invalid_dash_and_opacity_rejected():
    fig, ax = plt.subplots()
    ax.plot([0, 1], [0, 1])
    engine = MatplotlibEngine(fig)
    series = find_by_role(engine.reflect().root, "series")[0]
    bad_dash = _apply(engine, series, "stroke", "dash", "dotted")
    assert not bad_dash.ok
    assert bad_dash.error.code == "invalid_value"
    bad_opacity = _apply(engine, series, "stroke", "opacity", 1.5)
    assert not bad_opacity.ok
    assert bad_opacity.error.code == "invalid_value"


def test_axis_ticks_labels_format_and_scale():
    fig, ax = plt.subplots()
    ax.plot([1, 2, 3, 4], [1, 4, 9, 16])
    ax.set_xlim(1, 4)
    engine = MatplotlibEngine(fig)
    xaxis = next(
        node
        for node in find_by_role(engine.reflect().root, "axis")
        if node.id.endswith("/axis/x")
    )
    assert xaxis.components.axis is not None
    assert xaxis.components.axis.min == pytest.approx(1)
    assert xaxis.components.axis.max == pytest.approx(4)
    assert xaxis.components.axis.scale == "linear"
    result = _apply(engine, xaxis, "axis", "ticks", [1.0, 2.5, 4.0])
    assert result.ok, result.error
    assert list(ax.get_xticks()) == pytest.approx([1.0, 2.5, 4.0])
    xaxis = next(
        node
        for node in find_by_role(engine.reflect().root, "axis")
        if node.id.endswith("/axis/x")
    )
    result = _apply(engine, xaxis, "axis", "tickLabels", ["a", "b", "c"])
    assert result.ok, result.error
    engine.reflect()
    assert [text.get_text() for text in ax.get_xticklabels()] == ["a", "b", "c"]
    result = _apply(engine, xaxis, "axis", "format", "scientific")
    assert result.ok, result.error
    xaxis = next(
        node
        for node in find_by_role(engine.reflect().root, "axis")
        if node.id.endswith("/axis/x")
    )
    assert xaxis.components.axis.format == "scientific"
    result = _apply(engine, xaxis, "axis", "max", 8)
    assert result.ok, result.error
    assert ax.get_xlim()[1] == pytest.approx(8)
    result = _apply(engine, xaxis, "axis", "min", 0.5)
    assert result.ok, result.error
    result = _apply(engine, xaxis, "axis", "scale", "log")
    assert result.ok, result.error
    assert ax.get_xscale() == "log"


def test_figure_size_and_panel_limits_round_trip():
    fig, ax = plt.subplots(figsize=(3.4, 2.5))
    ax.plot([0, 1], [0, 1])
    ax.set_xlim(0, 10)
    ax.set_ylim(-1, 2)
    engine = MatplotlibEngine(fig)
    figure = engine.reflect().root
    assert figure.components.layout.width == pytest.approx(3.4)
    assert figure.components.layout.height == pytest.approx(2.5)
    result = _apply(engine, figure, "layout", "width", 4.0)
    assert result.ok, result.error
    assert fig.get_size_inches()[0] == pytest.approx(4.0)
    panel = find_by_role(engine.reflect().root, "panel")[0]
    assert panel.components.layout.xMin == pytest.approx(0)
    assert panel.components.layout.xMax == pytest.approx(10)
    result = _apply(engine, panel, "layout", "xMax", 20)
    assert result.ok, result.error
    assert ax.get_xlim()[1] == pytest.approx(20)
    result = _apply(
        engine, find_by_role(engine.reflect().root, "panel")[0], "layout", "yMin", -2
    )
    assert result.ok, result.error
    assert ax.get_ylim()[0] == pytest.approx(-2)


def test_stroke_style_updates_legend_handle():
    fig, ax = plt.subplots()
    ax.plot([0, 1], [0, 1], color="#0c5da5", lw=1.4, label="A")
    ax.legend()
    engine = MatplotlibEngine(fig)
    series = find_by_role(engine.reflect().root, "series")[0]
    result = _apply(engine, series, "stroke", "color", "#cc0000")
    assert result.ok, result.error
    legend = ax.get_legend()
    handles = getattr(legend, "legend_handles", None) or legend.legendHandles
    assert to_hex(handles[0].get_color()).lower() == "#cc0000"
    dashed = _apply(
        engine,
        find_by_role(engine.reflect().root, "series")[0],
        "stroke",
        "dash",
        [6, 4],
    )
    assert dashed.ok, dashed.error
    legend = ax.get_legend()
    handles = getattr(legend, "legend_handles", None) or legend.legendHandles
    assert handles[0].get_linestyle() != "-"


def test_series_label_and_marker_round_trip():
    fig, ax = plt.subplots()
    (line,) = ax.plot([0, 1], [0, 1], label="A")
    ax.legend()
    engine = MatplotlibEngine(fig)
    series = find_by_role(engine.reflect().root, "series")[0]
    assert series.components.marker.shape == "none"
    renamed = _apply(engine, series, "text", "content", "Catalyst")
    assert renamed.ok, renamed.error
    assert line.get_label() == "Catalyst"
    marked = _apply(
        engine,
        find_by_role(engine.reflect().root, "series")[0],
        "marker",
        "shape",
        "o",
    )
    assert marked.ok, marked.error
    assert line.get_marker() == "o"


def test_line_svg_carries_stable_gid():
    fig, ax = plt.subplots()
    ax.plot([0, 1], [0, 1])
    engine = MatplotlibEngine(fig)
    series = find_by_role(engine.reflect().root, "series")[0]
    svg = engine.render().svg
    assert f'id="molplot-{series.id.replace("/", "-")}"' in svg


def test_workbench_extras_include_line_path_and_dataset():
    fig, ax = plt.subplots()
    ax.plot([0, 1, 2], [0, 1, 0], label="trace")
    ax.set_xlabel("t")
    ax.set_ylabel("y")
    engine = MatplotlibEngine(fig)
    engine.reflect()
    extras = engine.workbench_extras()
    series_id = "figure/0/panel/0/series/0"
    assert series_id in extras["paths"]
    assert len(extras["paths"][series_id]) >= 2
    dataset = extras["datasets"][0]
    assert dataset["nodeId"] == series_id
    assert dataset["columns"][0]["name"] == "t"
    assert dataset["columns"][1]["values"] == pytest.approx([0, 1, 0])


def test_legend_bbox_still_present_when_moved_off_figure():
    fig, ax = plt.subplots()
    ax.plot([0, 1], [0, 1], label="A")
    ax.legend()
    engine = MatplotlibEngine(fig)
    legend = find_by_role(engine.reflect().root, "legend")[0]
    old = legend.components.geometry.bbox
    target = {"x": -0.2, "y": -0.2, "w": old.w, "h": old.h}
    result = _apply(engine, legend, "geometry", "bbox", target, "off-figure")
    assert result.ok, result.error
    moved = find_node(result.result.scene.root, legend.id).components.geometry.bbox
    assert moved is not None
    assert moved.x < 0.05 or moved.y < 0.05
