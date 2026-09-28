"""Engine protocol and shared Set-command gates. No backend imports."""

from __future__ import annotations

from typing import Protocol

from ._generated import (
    COMPONENT_NAMES,
    ApplyError,
    ApplyErrorCode,
    ApplyResult,
    Command,
    Diagnostics,
    EngineId,
    Node,
    RenderResult,
    Scene,
    View,
)
from .bbox import parse_bbox
from .hex import is_finite_number, normalize_hex
from .values import (
    parse_bool,
    parse_dash,
    parse_name,
    parse_opacity,
    parse_size,
    parse_tick_labels,
    parse_ticks,
)

_COMPONENT_SET = set(COMPONENT_NAMES)


class Engine(Protocol):
    engine_id: EngineId

    def revision(self) -> int: ...
    def reflect(self) -> Scene: ...
    def render(self) -> View: ...
    def diagnostics(self) -> Diagnostics: ...
    def apply(self, command: Command, request_id: str) -> ApplyResult: ...


def find_node(root: Node, node_id: str) -> Node | None:
    if root.id == node_id:
        return root
    for child in root.children:
        hit = find_node(child, node_id)
        if hit is not None:
            return hit
    return None


def find_by_role(root: Node, role: str) -> list[Node]:
    out: list[Node] = []

    def walk(node: Node) -> None:
        if node.role == role:
            out.append(node)
        for child in node.children:
            walk(child)

    walk(root)
    return out


def fail(request_id: str, code: ApplyErrorCode, message: str) -> ApplyResult:
    return ApplyResult(
        request_id=request_id, ok=False, error=ApplyError(code=code, message=message)
    )


def ok(request_id: str, result: RenderResult) -> ApplyResult:
    return ApplyResult(request_id=request_id, ok=True, result=result)


def render_result(engine: Engine, request_id: str) -> RenderResult:
    """Atomic Scene + View at the engine's current revision."""
    return RenderResult(
        request_id=request_id,
        revision=engine.revision(),
        scene=engine.reflect(),
        view=engine.render(),
        diagnostics=engine.diagnostics(),
    )


def not_implemented(request_id: str, what: str = "realize") -> ApplyResult:
    return fail(request_id, "not_implemented", f"{what} is not implemented in v0")


def check_set_command(
    scene: Scene, command: Command, revision: int
) -> ApplyError | None:
    if command.type != "set":
        return ApplyError(
            code="unknown_property", message=f"unsupported command {command.type}"
        )
    if command.base_revision != revision:
        return ApplyError(
            code="stale_revision",
            message=f"baseRevision {command.base_revision} != {revision}",
        )
    if command.component not in _COMPONENT_SET:
        return ApplyError(
            code="unknown_component", message=f"unknown component {command.component}"
        )
    node = find_node(scene.root, command.node_id)
    if node is None:
        return ApplyError(
            code="unknown_node", message=f"unknown node {command.node_id}"
        )
    props = node.editability.get(command.component) or {}
    state = props.get(command.property)
    if state is None:
        return ApplyError(
            code="unknown_property",
            message=f"{command.component}.{command.property} is not on this node",
        )
    if state != "editable":
        return ApplyError(
            code="not_editable",
            message=f"{command.component}.{command.property} is {state}",
        )
    if command.property == "color" and normalize_hex(command.value) is None:
        return ApplyError(code="invalid_value", message="color must be #rrggbb")
    if command.property == "width":
        if parse_size(command.value) is None:
            return ApplyError(
                code="invalid_value", message="width must be a positive finite number"
            )
    if command.property == "content" and not isinstance(command.value, str):
        return ApplyError(code="invalid_value", message="text content must be a string")
    if command.property == "bbox" and parse_bbox(command.value) is None:
        return ApplyError(
            code="invalid_value",
            message="bbox must be {x,y,w,h} with positive finite sizes",
        )
    if command.property == "dash" and parse_dash(command.value) is None:
        return ApplyError(
            code="invalid_value", message="dash must be a list of non-negative numbers"
        )
    if command.property == "opacity" and parse_opacity(command.value) is None:
        return ApplyError(
            code="invalid_value", message="opacity must be a number in [0, 1]"
        )
    if command.property == "size" and parse_size(command.value) is None:
        return ApplyError(
            code="invalid_value", message="size must be a positive finite number"
        )
    if (
        command.property in {"family", "weight", "style", "shape"}
        and parse_name(command.value) is None
    ):
        return ApplyError(
            code="invalid_value",
            message=f"{command.property} must be a non-empty string",
        )
    if command.property == "visible" and parse_bool(command.value) is None:
        return ApplyError(code="invalid_value", message="visible must be a boolean")
    if command.property == "zIndex" and not is_finite_number(command.value):
        return ApplyError(
            code="invalid_value", message="zIndex must be a finite number"
        )
    if command.property == "height" and parse_size(command.value) is None:
        return ApplyError(
            code="invalid_value", message="height must be a positive finite number"
        )
    if command.property in {"xMin", "xMax", "yMin", "yMax"} and not is_finite_number(
        command.value
    ):
        return ApplyError(
            code="invalid_value", message=f"{command.property} must be a finite number"
        )
    if command.component == "axis":
        if command.property in {"min", "max"} and not is_finite_number(command.value):
            return ApplyError(
                code="invalid_value",
                message=f"{command.property} must be a finite number",
            )
        if command.property == "ticks" and parse_ticks(command.value) is None:
            return ApplyError(
                code="invalid_value", message="ticks must be a list of finite numbers"
            )
        if (
            command.property == "tickLabels"
            and parse_tick_labels(command.value) is None
        ):
            return ApplyError(
                code="invalid_value", message="tickLabels must be a list of strings"
            )
        if (
            command.property in {"format", "scale"}
            and parse_name(command.value) is None
        ):
            return ApplyError(
                code="invalid_value",
                message=f"{command.property} must be a non-empty string",
            )
    return None
