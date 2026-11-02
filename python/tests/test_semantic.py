"""Editor contract tests — FakeEngine, no matplotlib."""

from pathlib import Path

from molplot.semantic import (
    Components,
    Node,
    Scene,
    SetCommand,
    Stroke,
    check_set_command,
    find_by_role,
    not_implemented,
    render_result,
)
from molplot.semantic.fake import FakeEngine
from molplot.semantic.values import (
    parse_bool,
    parse_dash,
    parse_name,
    parse_opacity,
    parse_size,
    parse_tick_labels,
    parse_ticks,
)

FIXTURE = (
    Path(__file__).resolve().parents[2] / "tests/fixtures/editor/set-stroke-color.json"
)


def _set_color(node_id: str, rev: int, value: str) -> SetCommand:
    return SetCommand(
        node_id=node_id,
        component="stroke",
        property="color",
        value=value,
        base_revision=rev,
    )


def test_set_editable_stroke_color_and_revision():
    engine = FakeEngine()
    series = find_by_role(engine.reflect().root, "series")[0]
    result = engine.apply(_set_color(series.id, engine.revision(), "#CC0000"), "req-1")
    assert result.ok
    assert result.result is not None
    assert result.result.revision == 2
    updated = find_by_role(result.result.scene.root, "series")[0]
    assert updated.components.stroke.color == "#cc0000"
    assert 'data-revision="2"' in result.result.view.svg
    assert result.result.revision == engine.revision()


def test_stale_revision_does_not_mutate():
    engine = FakeEngine()
    series = find_by_role(engine.reflect().root, "series")[0]
    before = series.components.stroke.color
    result = engine.apply(_set_color(series.id, 0, "#cc0000"), "req-stale")
    assert not result.ok
    assert result.error.code == "stale_revision"
    assert engine.revision() == 1
    assert (
        find_by_role(engine.reflect().root, "series")[0].components.stroke.color
        == before
    )


def test_readonly_property_fails():
    engine = FakeEngine()
    mapped = find_by_role(engine.reflect().root, "series")[1]
    result = engine.apply(_set_color(mapped.id, engine.revision(), "#cc0000"), "req-ro")
    assert not result.ok
    assert result.error.code == "not_editable"


def test_unknown_node_fails():
    engine = FakeEngine()
    result = engine.apply(
        _set_color("no-such-node", engine.revision(), "#cc0000"), "req-missing"
    )
    assert not result.ok
    assert result.error.code == "unknown_node"


def test_invalid_color_fails():
    engine = FakeEngine()
    series = find_by_role(engine.reflect().root, "series")[0]
    result = engine.apply(_set_color(series.id, engine.revision(), "red"), "req-bad")
    assert not result.ok
    assert result.error.code == "invalid_value"


def test_set_title_text():
    engine = FakeEngine()
    title = find_by_role(engine.reflect().root, "title")[0]
    result = engine.apply(
        SetCommand(
            node_id=title.id,
            component="text",
            property="content",
            value="Kinetic energy",
            base_revision=engine.revision(),
        ),
        "req-title",
    )
    assert result.ok
    assert (
        find_by_role(result.result.scene.root, "title")[0].components.text.content
        == "Kinetic energy"
    )


def test_realize_not_implemented():
    result = not_implemented("req-realize")
    assert not result.ok
    assert result.error.code == "not_implemented"


def test_stale_request_id_discard():
    engine = FakeEngine()
    first = render_result(engine, "1")
    second = render_result(engine, "2")
    seen = first.request_id

    def accept(request_id: str) -> bool:
        nonlocal seen
        if int(request_id) < int(seen):
            return False
        seen = request_id
        return True

    assert accept(second.request_id)
    assert not accept(first.request_id)


def test_check_set_command_is_backend_free():
    engine = FakeEngine()
    err = check_set_command(engine.reflect(), _set_color("series-0", 1, "#cc0000"), 1)
    assert err is None


def test_shared_fixture_exists():
    assert FIXTURE.is_file()


def _gate_scene():
    return Scene(
        engine_id="vega",
        root=Node(
            id="n",
            role="series",
            components=Components(
                stroke=Stroke(color="#0c5da5", width=1, opacity=1, dash=[2, 2])
            ),
            editability={
                "stroke": {
                    "color": "editable",
                    "width": "editable",
                    "opacity": "editable",
                    "dash": "editable",
                },
                "appearance": {
                    "visible": "editable",
                    "opacity": "editable",
                    "zIndex": "editable",
                },
                "typography": {"size": "editable", "family": "editable"},
            },
        ),
    )


def _set(prop, value, component="stroke"):
    return SetCommand(
        node_id="n", component=component, property=prop, value=value, base_revision=1
    )


def test_check_set_command_rejects_new_invalid_values():
    scene = _gate_scene()
    assert check_set_command(scene, _set("dash", [2, 1]), 1) is None
    assert check_set_command(scene, _set("dash", "dotted"), 1).code == "invalid_value"
    assert check_set_command(scene, _set("opacity", 0.2), 1) is None
    assert check_set_command(scene, _set("opacity", 2), 1).code == "invalid_value"
    assert check_set_command(scene, _set("size", 12, "typography"), 1) is None
    assert (
        check_set_command(scene, _set("size", 0, "typography"), 1).code
        == "invalid_value"
    )
    assert (
        check_set_command(scene, _set("family", "DejaVu Sans", "typography"), 1) is None
    )
    assert (
        check_set_command(scene, _set("family", "  ", "typography"), 1).code
        == "invalid_value"
    )
    assert check_set_command(scene, _set("visible", True, "appearance"), 1) is None
    assert (
        check_set_command(scene, _set("visible", "yes", "appearance"), 1).code
        == "invalid_value"
    )
    assert check_set_command(scene, _set("zIndex", 3, "appearance"), 1) is None
    assert (
        check_set_command(scene, _set("zIndex", "front", "appearance"), 1).code
        == "invalid_value"
    )


def test_value_parsers():
    assert parse_opacity(0.5) == 0.5
    assert parse_opacity(1.2) is None
    assert parse_size(2) == 2
    assert parse_size(0) is None
    assert parse_dash([1, 0, 2]) == [1.0, 0.0, 2.0]
    assert parse_dash([-1]) is None
    assert parse_name(" bold ") == "bold"
    assert parse_name("") is None
    assert parse_bool(False) is False
    assert parse_bool(1) is None
    assert parse_ticks([0, 1.5]) == [0.0, 1.5]
    assert parse_ticks("0,1") is None
    assert parse_tick_labels(["a", "b"]) == ["a", "b"]
    assert parse_tick_labels([1]) is None


def test_check_set_command_axis_values():
    scene = Scene(
        engine_id="vega",
        root=Node(
            id="ax",
            role="axis",
            editability={
                "axis": {
                    "min": "editable",
                    "ticks": "editable",
                    "tickLabels": "editable",
                    "format": "editable",
                    "scale": "editable",
                }
            },
        ),
    )

    def set_axis(prop, value):
        return SetCommand(
            node_id="ax",
            component="axis",
            property=prop,
            value=value,
            base_revision=1,
        )

    assert check_set_command(scene, set_axis("ticks", [0, 1, 2]), 1) is None
    assert check_set_command(scene, set_axis("ticks", "0,1"), 1).code == "invalid_value"
    assert check_set_command(scene, set_axis("tickLabels", ["0", "1"]), 1) is None
    assert (
        check_set_command(scene, set_axis("tickLabels", [0]), 1).code == "invalid_value"
    )
    assert check_set_command(scene, set_axis("format", "scientific"), 1) is None
    assert check_set_command(scene, set_axis("format", "  "), 1).code == "invalid_value"
    assert check_set_command(scene, set_axis("min", 1e-3), 1) is None
    assert check_set_command(scene, set_axis("min", "lo"), 1).code == "invalid_value"
