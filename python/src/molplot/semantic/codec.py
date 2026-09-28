"""CamelCase JSON <-> dataclasses. Wire field names match the TS types."""

from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Any

from ._generated import (
    Appearance,
    ApplyResult,
    Axis,
    BBox,
    Command,
    Components,
    Fill,
    Geometry,
    Layout,
    Marker,
    Node,
    RenderResult,
    Scene,
    SetCommand,
    Stroke,
    Text,
    Typography,
    View,
)


def _drop_none(value: Any) -> Any:
    if is_dataclass(value) and not isinstance(value, type):
        value = asdict(value)
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            if item is None:
                continue
            cleaned = _drop_none(item)
            if cleaned is None or cleaned == {} or cleaned == []:
                if key in {"children", "traversal", "editability", "components"}:
                    out[_wire_key(key)] = cleaned if cleaned is not None else []
                continue
            out[_wire_key(key)] = cleaned
        return out
    if isinstance(value, list):
        return [_drop_none(item) for item in value]
    return value


def _wire_key(key: str) -> str:
    return {
        "engine_id": "engineId",
        "request_id": "requestId",
        "node_id": "nodeId",
        "base_revision": "baseRevision",
        "zIndex": "zIndex",
    }.get(key, key)


def node_to_json(node: Node) -> dict[str, Any]:
    payload = _drop_none(node)
    payload.setdefault("children", [])
    payload.setdefault("components", {})
    payload.setdefault("editability", {})
    return payload


def scene_to_json(scene: Scene) -> dict[str, Any]:
    return {"engineId": scene.engine_id, "root": node_to_json(scene.root)}


def view_to_json(view: View) -> dict[str, Any]:
    return {"kind": view.kind, "svg": view.svg}


def render_result_to_json(result: RenderResult) -> dict[str, Any]:
    return {
        "requestId": result.request_id,
        "revision": result.revision,
        "scene": scene_to_json(result.scene),
        "view": view_to_json(result.view),
        "diagnostics": {
            "traversal": [
                {
                    k: v
                    for k, v in {
                        "ref": row.ref,
                        "status": row.status,
                        "nodeId": row.node_id,
                        "detail": row.detail,
                    }.items()
                    if v is not None
                }
                for row in result.diagnostics.traversal
            ]
        },
    }


def apply_result_to_json(result: ApplyResult) -> dict[str, Any]:
    out: dict[str, Any] = {"requestId": result.request_id, "ok": result.ok}
    if result.error is not None:
        out["error"] = {"code": result.error.code, "message": result.error.message}
    if result.result is not None:
        out["result"] = render_result_to_json(result.result)
    return out


def command_from_json(raw: dict[str, Any]) -> Command:
    return SetCommand(
        type=raw.get("type", "set"),
        node_id=raw["nodeId"],
        component=raw["component"],
        property=raw["property"],
        value=raw["value"],
        base_revision=int(raw["baseRevision"]),
    )


def _bbox(raw: Any) -> BBox | None:
    if not isinstance(raw, dict):
        return None
    return BBox(
        x=float(raw["x"]), y=float(raw["y"]), w=float(raw["w"]), h=float(raw["h"])
    )


def _components(raw: Any) -> Components:
    if not isinstance(raw, dict):
        return Components()
    kwargs: dict[str, Any] = {}
    if "geometry" in raw and isinstance(raw["geometry"], dict):
        kwargs["geometry"] = Geometry(bbox=_bbox(raw["geometry"].get("bbox")))
    if "appearance" in raw and isinstance(raw["appearance"], dict):
        kwargs["appearance"] = Appearance(
            **{k: raw["appearance"].get(k) for k in ("visible", "opacity", "zIndex")}
        )
    if "stroke" in raw and isinstance(raw["stroke"], dict):
        kwargs["stroke"] = Stroke(
            **{k: raw["stroke"].get(k) for k in ("color", "width", "opacity", "dash")}
        )
    if "fill" in raw and isinstance(raw["fill"], dict):
        kwargs["fill"] = Fill(**{k: raw["fill"].get(k) for k in ("color", "opacity")})
    if "text" in raw and isinstance(raw["text"], dict):
        kwargs["text"] = Text(content=raw["text"].get("content"))
    if "typography" in raw and isinstance(raw["typography"], dict):
        t = raw["typography"]
        kwargs["typography"] = Typography(
            family=t.get("family"),
            size=t.get("size"),
            weight=t.get("weight"),
            style=t.get("style"),
            color=t.get("color"),
        )
    if "layout" in raw and isinstance(raw["layout"], dict):
        layout = raw["layout"]
        kwargs["layout"] = Layout(
            **{
                k: layout.get(k)
                for k in ("width", "height", "xMin", "xMax", "yMin", "yMax")
            }
        )
    if "marker" in raw and isinstance(raw["marker"], dict):
        marker = raw["marker"]
        kwargs["marker"] = Marker(
            **{k: marker.get(k) for k in ("shape", "size", "color")}
        )
    if "axis" in raw and isinstance(raw["axis"], dict):
        axis = raw["axis"]
        kwargs["axis"] = Axis(
            **{
                k: axis.get(k)
                for k in ("min", "max", "ticks", "tickLabels", "format", "scale")
            }
        )
    return Components(**kwargs)


def node_from_json(raw: dict[str, Any]) -> Node:
    children = [node_from_json(c) for c in raw.get("children") or []]
    return Node(
        id=raw["id"],
        role=raw["role"],
        label=raw.get("label"),
        children=children,
        components=_components(raw.get("components")),
        editability=raw.get("editability") or {},
    )
