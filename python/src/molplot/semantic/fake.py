"""In-memory Engine used to prove the contract without a backend."""

from __future__ import annotations

from ._generated import (
    Command,
    Components,
    Diagnostics,
    Geometry,
    Node,
    Scene,
    Stroke,
    Text,
    TraversalEntry,
    View,
)
from .engine import check_set_command, fail, not_implemented, ok, render_result
from .hex import normalize_hex


def _series(node_id: str, label: str, stroke: Stroke, color_state: str) -> Node:
    return Node(
        id=node_id,
        role="series",
        label=label,
        children=[],
        components=Components(stroke=stroke, geometry=Geometry(bbox=None)),
        editability={
            "stroke": {
                "color": color_state,
                "width": color_state,
                "opacity": "readonly",
            }
        },
    )


class FakeEngine:
    engine_id = "vega"

    def __init__(self) -> None:
        self._rev = 1
        self._stroke_color = "#0c5da5"
        self._stroke_width = 1.5
        self._title = "Energy"
        self._readonly_color = "#888888"

    def revision(self) -> int:
        return self._rev

    def reflect(self) -> Scene:
        from ._generated import BBox

        editable = _series(
            "series-0",
            "Series: energy",
            Stroke(color=self._stroke_color, width=self._stroke_width),
            "editable",
        )
        editable.components.geometry = Geometry(bbox=BBox(0.1, 0.1, 0.8, 0.4))
        mapped = _series(
            "series-1",
            "Series: mapped",
            Stroke(color=self._readonly_color, width=1.0),
            "readonly",
        )
        title = Node(
            id="title-0",
            role="title",
            label="Title",
            components=Components(
                text=Text(content=self._title),
                geometry=Geometry(bbox=BBox(0.2, 0.02, 0.6, 0.08)),
            ),
            editability={"text": {"content": "editable"}},
        )
        panel = Node(
            id="panel-0",
            role="panel",
            label="Panel",
            children=[editable, mapped, title],
        )
        root = Node(
            id="figure-0",
            role="figure",
            label="Figure",
            children=[panel],
            components=Components(geometry=Geometry(bbox=BBox(0.0, 0.0, 1.0, 1.0))),
        )
        return Scene(engine_id=self.engine_id, root=root)

    def render(self) -> View:
        return View(kind="svg", svg=f'<svg data-revision="{self._rev}"/>')

    def diagnostics(self) -> Diagnostics:
        return Diagnostics(
            traversal=[
                TraversalEntry("fake:figure", "represented", "figure-0"),
                TraversalEntry("fake:series-0", "represented", "series-0"),
                TraversalEntry("fake:series-1", "represented", "series-1"),
                TraversalEntry("fake:title", "represented", "title-0"),
                TraversalEntry("fake:spine", "consumed", "panel-0"),
                TraversalEntry("fake:patch", "internal"),
            ]
        )

    def apply(self, command: Command, request_id: str):
        if command.type != "set":
            return not_implemented(request_id, command.type)
        err = check_set_command(self.reflect(), command, self._rev)
        if err is not None:
            return fail(request_id, err.code, err.message)
        try:
            if command.node_id == "series-0" and command.component == "stroke":
                if command.property == "color":
                    hex_ = normalize_hex(command.value)
                    if hex_ is None:
                        return fail(request_id, "invalid_value", "color")
                    self._stroke_color = hex_
                elif command.property == "width":
                    self._stroke_width = float(command.value)
                else:
                    return fail(request_id, "apply_failed", "unhandled set")
            elif (
                command.node_id == "title-0"
                and command.component == "text"
                and command.property == "content"
            ):
                self._title = str(command.value)
            else:
                return fail(request_id, "apply_failed", "unhandled set")
        except Exception as exc:
            return fail(request_id, "apply_failed", str(exc))
        self._rev += 1
        return ok(request_id, render_result(self, request_id))
