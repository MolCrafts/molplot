"""MatplotlibEngine: live Figure is execution authority."""

from __future__ import annotations

import math
from typing import Any

from matplotlib import ticker as mticker
from matplotlib.axes import Axes
from matplotlib.axis import Axis as MplAxis
from matplotlib.collections import Collection
from matplotlib.container import BarContainer
from matplotlib.figure import Figure
from matplotlib.legend import Legend
from matplotlib.lines import Line2D
from matplotlib.text import Text as MplText

from molplot.semantic import (
    Appearance,
    ApplyResult,
    Axis,
    BBox,
    Command,
    Components,
    Diagnostics,
    Fill,
    Geometry,
    Layout,
    Marker,
    Node,
    Scene,
    Stroke,
    Text,
    TraversalEntry,
    Typography,
    View,
    check_set_command,
    fail,
    find_node,
    not_implemented,
    ok,
    render_result,
)
from molplot.semantic.bbox import parse_bbox
from molplot.semantic.hex import is_finite_number, normalize_hex
from molplot.semantic.values import (
    parse_bool,
    parse_dash,
    parse_name,
    parse_opacity,
    parse_size,
    parse_tick_labels,
    parse_ticks,
)

try:
    from matplotlib.container import ErrorbarContainer, StemContainer
except ImportError:  # pragma: no cover

    class ErrorbarContainer:  # type: ignore[no-redef]
        pass

    class StemContainer:  # type: ignore[no-redef]
        pass


_AXIS_SCALES = {"linear", "log", "symlog"}
_AXIS_FORMATS = {"auto", "scientific", "plain", "percent"}


def _axis_name(axis: Any, ax: Any) -> str:
    name = getattr(axis, "axis_name", None)
    if name in {"x", "y"}:
        return name
    if axis is getattr(ax, "xaxis", None):
        return "x"
    return "y"


def _axis_format(axis: Any) -> str:
    fmt = axis.get_major_formatter()
    if isinstance(fmt, mticker.PercentFormatter):
        return "percent"
    if isinstance(fmt, mticker.LogFormatter):
        return "scientific"
    if isinstance(fmt, mticker.ScalarFormatter):
        scientific = True
        if hasattr(fmt, "get_scientific"):
            scientific = bool(fmt.get_scientific())
        limits = getattr(fmt, "_powerlimits", None)
        if scientific and limits == (0, 0):
            return "scientific"
        if not scientific:
            return "plain"
    return "auto"


def _axis_ticks(axis: Any) -> tuple[list[float], list[str]]:
    locs = [float(v) for v in axis.get_majorticklocs()]
    vmin, vmax = (float(v) for v in axis.get_view_interval())
    lo, hi = (min(vmin, vmax), max(vmin, vmax))
    ticks = [t for t in locs if lo - 1e-12 <= t <= hi + 1e-12]
    labels = [tick.get_text() for tick in axis.get_majorticklabels()]
    if len(labels) < len(ticks):
        labels = labels + [""] * (len(ticks) - len(labels))
    elif len(labels) > len(ticks):
        labels = labels[: len(ticks)]
    return ticks, labels


def _set_axis_formatter(axis: Any, kind: str) -> None:
    if kind == "scientific":
        fmt = mticker.ScalarFormatter(useOffset=False)
        fmt.set_scientific(True)
        fmt.set_powerlimits((0, 0))
        axis.set_major_formatter(fmt)
        return
    if kind == "plain":
        fmt = mticker.ScalarFormatter(useOffset=False)
        fmt.set_scientific(False)
        axis.set_major_formatter(fmt)
        return
    if kind == "percent":
        axis.set_major_formatter(mticker.PercentFormatter(xmax=1.0))
        return
    axis.set_major_formatter(mticker.ScalarFormatter())


def artist_gid(node_id: str) -> str:
    """Stable SVG id for a Scene node. Must match page `artistGid`."""
    return "molplot-" + node_id.replace("/", "-")


def _pt_to_px(pt: float, dpi: float) -> float:
    return float(pt) * float(dpi) / 72.0


def _px_to_pt(px: float, dpi: float) -> float:
    return float(px) * 72.0 / float(dpi)


def _scalar_hex(color: Any) -> str | None:
    from matplotlib.colors import to_hex

    try:
        if hasattr(color, "ndim") and getattr(color, "ndim", 0) > 1:
            return None
        if hasattr(color, "__len__") and not isinstance(color, (str, bytes)):
            try:
                length = len(color)
            except TypeError:
                length = 0
            if length > 4:
                return None
        return to_hex(color).lower()
    except (ValueError, TypeError):
        return None


def _uniform_hex(colors: Any) -> str | None:
    found: list[str] = []
    if colors is None:
        return None
    try:
        seq = list(colors)
    except TypeError:
        hex_ = _scalar_hex(colors)
        return hex_
    if seq and not hasattr(seq[0], "__len__"):
        hex_ = _scalar_hex(seq)
        return hex_
    for item in seq:
        hex_ = _scalar_hex(item)
        if hex_ is None:
            return None
        found.append(hex_)
    if not found:
        return None
    if len(set(found)) != 1:
        return None
    return found[0]


def _as_figs(fig_or_figs: Any) -> list[Any]:
    if isinstance(fig_or_figs, (list, tuple)):
        figs = [item for item in fig_or_figs if item is not None]
        if not figs:
            raise ValueError("MatplotlibEngine needs at least one Figure")
        return list(figs)
    if fig_or_figs is None:
        raise ValueError("MatplotlibEngine needs at least one Figure")
    return [fig_or_figs]


def _iter_artists(obj: Any) -> list[Any]:
    out: list[Any] = []

    def walk(item: Any) -> None:
        if item is None:
            return
        if isinstance(item, (list, tuple)):
            for child in item:
                walk(child)
            return
        out.append(item)

    walk(obj)
    return out


def _line_dash_pts(line: Line2D) -> list[float]:
    seq = None
    unscaled = getattr(line, "_unscaled_dash_pattern", None)
    if isinstance(unscaled, tuple) and len(unscaled) == 2:
        seq = unscaled[1]
    elif hasattr(line, "get_dashes"):
        dashes = line.get_dashes()
        if dashes:
            seq = dashes[1]
    if not seq:
        return []
    return [float(x) for x in seq]


def _line_dash(line: Line2D, dpi: float) -> list[float]:
    return [_pt_to_px(pt, dpi) for pt in _line_dash_pts(line)]


def _set_line_dash(line: Line2D, dash_px: list[float], dpi: float) -> None:
    if not dash_px:
        line.set_linestyle("-")
        return
    line.set_dashes([_px_to_pt(x, dpi) for x in dash_px])


def _alpha(artist: Any) -> float:
    value = artist.get_alpha()
    if value is None:
        return 1.0
    return float(value)


def _uniform_width_px(artists: list[Any], dpi: float) -> float | None:
    widths: list[float] = []
    for artist in artists:
        if isinstance(artist, Line2D):
            widths.append(float(artist.get_linewidth()))
        elif isinstance(artist, Collection):
            try:
                values = [float(w) for w in artist.get_linewidths()]
            except Exception:
                continue
            if not values:
                continue
            if len({round(v, 6) for v in values}) != 1:
                return None
            widths.append(values[0])
        elif hasattr(artist, "get_linewidth"):
            try:
                widths.append(float(artist.get_linewidth()))
            except Exception:
                continue
    if not widths:
        return None
    if len({round(v, 6) for v in widths}) != 1:
        return None
    return _pt_to_px(widths[0], dpi)


class MatplotlibEngine:
    engine_id = "matplotlib"

    def __init__(self, fig: Any) -> None:
        self._figs = _as_figs(fig)
        self._fig = self._figs[0]
        self._rev = 1
        self._handles: dict[str, Any] = {}
        self._diagnostics = Diagnostics()

    def revision(self) -> int:
        return self._rev

    def _bind(self, node_id: str, obj: Any) -> str:
        self._handles[node_id] = obj
        if isinstance(obj, Line2D) and hasattr(obj, "set_gid"):
            obj.set_gid(artist_gid(node_id))
        return node_id

    def _mark(
        self,
        obj: Any,
        status: str,
        node_id: str | None = None,
        detail: str | None = None,
    ) -> None:
        if obj is None:
            return
        self._diagnostics.traversal.append(
            TraversalEntry(
                ref=f"artist:{id(obj)}", status=status, node_id=node_id, detail=detail
            )
        )

    def _fig_of(self, artist: Any) -> Any:
        fig = getattr(artist, "figure", None)
        if fig is not None:
            return fig
        for member in _iter_artists(artist):
            fig = getattr(member, "figure", None)
            if fig is not None:
                return fig
        return self._fig

    def _ensure_drawn(self, fig: Any | None = None) -> None:
        (fig or self._fig).canvas.draw()

    def _bbox(self, artist: Any) -> BBox | None:
        fig = self._fig_of(artist)
        try:
            renderer = fig.canvas.get_renderer()
        except Exception:
            fig.canvas.draw()
            renderer = fig.canvas.get_renderer()
        try:
            bb = artist.get_window_extent(renderer)
        except Exception:
            try:
                bb = artist.get_tightbbox(renderer)
            except Exception:
                return None
        if bb is None:
            return None
        try:
            fig_bb = fig.get_window_extent(renderer)
        except Exception:
            return None
        fw, fh = fig_bb.width, fig_bb.height
        if fw <= 0 or fh <= 0:
            return None
        w, h = bb.width / fw, bb.height / fh
        if w <= 0 and h <= 0:
            return None
        x = (bb.x0 - fig_bb.x0) / fw
        y = (fig_bb.y1 - bb.y1) / fh
        return BBox(x=float(x), y=float(y), w=float(w), h=float(h))

    def reflect(self) -> Scene:
        self._handles = {}
        self._diagnostics = Diagnostics()
        for fig in self._figs:
            self._ensure_drawn(fig)
        if len(self._figs) == 1:
            return Scene(
                engine_id="matplotlib",
                root=self._reflect_figure(self._figs[0], "figure/0"),
            )
        children = [
            self._reflect_figure(fig, f"figure/{i}") for i, fig in enumerate(self._figs)
        ]
        root = Node(
            id="session",
            role="figure",
            label="Session",
            children=children,
            components=Components(geometry=Geometry(bbox=BBox(0.0, 0.0, 1.0, 1.0))),
        )
        return Scene(engine_id="matplotlib", root=root)

    def _reflect_figure(self, fig: Any, prefix: str) -> Node:
        node_id = self._bind(prefix, fig)
        self._mark(fig, "represented", node_id)
        if getattr(fig, "patch", None) is not None:
            self._mark(fig.patch, "internal", node_id, "figure.patch")
        children: list[Node] = []
        panel_i = 0
        cb_i = 0
        for ax in list(fig.axes):
            cb = getattr(ax, "_colorbar", None)
            if cb is not None:
                children.append(
                    self._reflect_colorbar(ax, cb, f"{prefix}/colorbar/{cb_i}")
                )
                cb_i += 1
                continue
            children.append(self._reflect_panel(ax, f"{prefix}/panel/{panel_i}"))
            panel_i += 1
        if getattr(fig, "_suptitle", None) is not None and fig._suptitle.get_text():
            children.append(
                self._reflect_text(
                    fig._suptitle, f"{prefix}/title", "title", "Suptitle"
                )
            )
        self._census_unknown(fig)
        width, height = (float(v) for v in fig.get_size_inches())
        face = _scalar_hex(fig.get_facecolor())
        return Node(
            id=node_id,
            role="figure",
            label="Figure",
            children=children,
            components=Components(
                geometry=Geometry(bbox=BBox(0.0, 0.0, 1.0, 1.0)),
                layout=Layout(width=width, height=height),
                fill=Fill(color=face),
            ),
            editability={
                "layout": {"width": "editable", "height": "editable"},
                "fill": {"color": "editable" if face else "readonly"},
            },
        )

    def _reflect_colorbar(self, ax: Any, cb: Any, node_id: str) -> Node:
        self._bind(node_id, ax)
        self._mark(ax, "represented", node_id, "colorbar")
        self._mark(cb, "consumed", node_id, "Colorbar")
        if getattr(ax, "patch", None) is not None:
            self._mark(ax.patch, "internal", node_id)
        return Node(
            id=node_id,
            role="colorbar",
            label="Colorbar",
            components=Components(geometry=Geometry(bbox=self._bbox(ax))),
            editability={"geometry": {"bbox": "readonly"}},
        )

    def _reflect_panel(self, ax: Any, prefix: str) -> Node:
        node_id = self._bind(prefix, ax)
        self._mark(ax, "represented", node_id)
        if getattr(ax, "patch", None) is not None:
            self._mark(ax.patch, "internal", node_id, "axes.patch")
        consumed: set[int] = set()
        kids: list[Node] = []
        for name, axis in (("x", ax.xaxis), ("y", ax.yaxis)):
            kids.append(
                self._reflect_axis(axis, name, ax, consumed, f"{prefix}/axis/{name}")
            )
        title = ax.title
        if title is not None and title.get_text():
            kids.append(self._reflect_text(title, f"{prefix}/title", "title", "Title"))
        series_i = 0
        for container in list(getattr(ax, "containers", []) or []):
            kids.append(
                self._reflect_container(
                    container, consumed, f"{prefix}/series/{series_i}"
                )
            )
            series_i += 1
        for line in list(ax.lines):
            if id(line) in consumed:
                continue
            kids.append(self._reflect_line(line, f"{prefix}/series/{series_i}"))
            series_i += 1
        for coll in list(ax.collections):
            if id(coll) in consumed:
                continue
            kids.append(self._reflect_collection(coll, f"{prefix}/series/{series_i}"))
            series_i += 1
        anno_i = 0
        for text in list(getattr(ax, "texts", []) or []):
            if id(text) in consumed or not isinstance(text, MplText):
                continue
            if not (text.get_text() or "").strip():
                self._mark(text, "internal", prefix, "empty-text")
                consumed.add(id(text))
                continue
            kids.append(
                self._reflect_text(
                    text, f"{prefix}/annotation/{anno_i}", "annotation", "Annotation"
                )
            )
            consumed.add(id(text))
            anno_i += 1
        legend = ax.get_legend()
        if legend is not None:
            kids.append(self._reflect_legend(legend, consumed, f"{prefix}/legend"))
        xmin, xmax = (float(v) for v in ax.get_xlim())
        ymin, ymax = (float(v) for v in ax.get_ylim())
        face = _scalar_hex(ax.get_facecolor())
        return Node(
            id=node_id,
            role="panel",
            label="Axes",
            children=kids,
            components=Components(
                geometry=Geometry(bbox=self._bbox(ax)),
                layout=Layout(xMin=xmin, xMax=xmax, yMin=ymin, yMax=ymax),
                fill=Fill(color=face),
            ),
            editability={
                "geometry": {"bbox": "editable"},
                "layout": {
                    "xMin": "editable",
                    "xMax": "editable",
                    "yMin": "editable",
                    "yMax": "editable",
                },
                "fill": {"color": "editable" if face else "readonly"},
            },
        )

    def _reflect_axis(
        self, axis: Any, name: str, ax: Any, consumed: set[int], node_id: str
    ) -> Node:
        self._bind(node_id, axis)
        self._mark(axis, "represented", node_id, f"{name}axis")
        for spine_name, spine in ax.spines.items():
            owned = (spine_name in {"bottom", "top"} and name == "x") or (
                spine_name in {"left", "right"} and name == "y"
            )
            if owned:
                self._mark(spine, "consumed", node_id, f"spine:{spine_name}")
                consumed.add(id(spine))
        for tick in axis.get_major_ticks() + axis.get_minor_ticks():
            for part in (
                tick.tick1line,
                tick.tick2line,
                tick.label1,
                tick.label2,
                tick.gridline,
            ):
                if part is not None:
                    self._mark(part, "consumed", node_id, "tick")
                    consumed.add(id(part))
        label = axis.get_label()
        text = Text(content="")
        typography = None
        geometry = Geometry()
        editability: dict[str, dict[str, str]] = {
            "text": {"content": "editable"},
            "typography": {
                "family": "editable",
                "size": "editable",
                "weight": "editable",
                "style": "editable",
                "color": "editable",
            },
        }
        if label is not None:
            self._mark(label, "consumed", node_id, "axis-label")
            consumed.add(id(label))
            text, typography, geometry, extra = self._text_state(label)
            editability.update(extra)
        vmin, vmax = (float(v) for v in axis.get_view_interval())
        ticks, labels = _axis_ticks(axis)
        scale = ax.get_xscale() if name == "x" else ax.get_yscale()
        axis_state = Axis(
            min=float(vmin),
            max=float(vmax),
            ticks=ticks,
            tickLabels=labels,
            format=_axis_format(axis),
            scale=str(scale),
        )
        editability["axis"] = {
            "min": "editable",
            "max": "editable",
            "ticks": "editable",
            "tickLabels": "editable",
            "format": "editable",
            "scale": "editable",
        }
        return Node(
            id=node_id,
            role="axis",
            label=f"{name} axis",
            components=Components(
                text=text,
                typography=typography,
                geometry=geometry,
                axis=axis_state,
            ),
            editability=editability,
        )

    def _text_state(
        self, text: MplText
    ) -> tuple[Text, Typography, Geometry, dict[str, dict[str, str]]]:
        box = self._bbox(text)
        color = _scalar_hex(text.get_color())
        typography = Typography(
            family=str(text.get_fontname() or "") or None,
            size=float(text.get_fontsize()),
            weight=str(text.get_fontweight()),
            style=str(text.get_fontstyle()),
            color=color,
        )
        extra = {
            "typography": {
                "family": "editable",
                "size": "editable",
                "weight": "editable",
                "style": "editable",
                "color": "editable" if color else "readonly",
            },
            "appearance": {
                "visible": "editable",
                "opacity": "editable",
                "zIndex": "editable",
            },
        }
        if box is not None:
            extra["geometry"] = {"bbox": "editable"}
        return (
            Text(content=text.get_text() or ""),
            typography,
            Geometry(bbox=box),
            extra,
        )

    def _reflect_text(self, text: MplText, node_id: str, role: str, label: str) -> Node:
        self._bind(node_id, text)
        self._mark(text, "represented", node_id, "Text")
        content, typography, geometry, extra = self._text_state(text)
        extra["text"] = {"content": "editable"}
        return Node(
            id=node_id,
            role=role,  # type: ignore[arg-type]
            label=label,
            components=Components(
                text=content,
                typography=typography,
                geometry=geometry,
                appearance=Appearance(
                    visible=bool(text.get_visible()),
                    opacity=_alpha(text),
                    zIndex=float(text.get_zorder()),
                ),
            ),
            editability=extra,
        )

    def _reflect_line(self, line: Line2D, node_id: str) -> Node:
        self._bind(node_id, line)
        self._mark(line, "represented", node_id, "Line2D")
        color = _scalar_hex(line.get_color())
        dpi = float(self._fig_of(line).dpi)
        width = _pt_to_px(float(line.get_linewidth()), dpi)
        dash = _line_dash(line, dpi)
        stroke = Stroke(color=color, width=width, opacity=_alpha(line), dash=dash)
        marker = self._marker_of(line)
        label = line.get_label() or "Series"
        return Node(
            id=node_id,
            role="series",
            label=label,
            components=Components(
                stroke=stroke,
                marker=marker,
                text=Text(content="" if str(label).startswith("_") else label),
                geometry=Geometry(bbox=self._bbox(line)),
                appearance=Appearance(
                    visible=bool(line.get_visible()),
                    opacity=_alpha(line),
                    zIndex=float(line.get_zorder()),
                ),
            ),
            editability={
                "stroke": {
                    "color": "editable" if color else "readonly",
                    "width": "editable",
                    "opacity": "editable",
                    "dash": "editable",
                },
                "marker": {
                    "shape": "editable",
                    "size": "editable",
                    "color": "editable" if marker.color else "readonly",
                },
                "text": {"content": "editable"},
                "appearance": {
                    "visible": "editable",
                    "opacity": "editable",
                    "zIndex": "editable",
                },
            },
        )

    def _marker_of(self, line: Line2D) -> Marker:
        raw = line.get_marker()
        if raw in (None, "None", "none", ""):
            shape = "none"
        else:
            shape = str(raw)
        face = _scalar_hex(line.get_markerfacecolor())
        return Marker(shape=shape, size=float(line.get_markersize()), color=face)

    def _reflect_collection(self, coll: Collection, node_id: str) -> Node:
        self._bind(node_id, coll)
        self._mark(coll, "represented", node_id, type(coll).__name__)
        dpi = float(self._fig_of(coll).dpi)
        face = _uniform_hex(coll.get_facecolor())
        edge = _uniform_hex(coll.get_edgecolor())
        width = _uniform_width_px([coll], dpi)
        fill_state = "editable" if face else "readonly"
        stroke_state = "editable" if edge else "readonly"
        width_state = "editable" if width is not None else "readonly"
        return Node(
            id=node_id,
            role="series",
            label="Series",
            components=Components(
                fill=Fill(color=face, opacity=_alpha(coll)),
                stroke=Stroke(color=edge, width=width, opacity=_alpha(coll)),
                geometry=Geometry(bbox=self._bbox(coll)),
                appearance=Appearance(
                    visible=bool(coll.get_visible()),
                    opacity=_alpha(coll),
                    zIndex=float(coll.get_zorder()),
                ),
            ),
            editability={
                "fill": {
                    "color": fill_state,
                    "opacity": "editable" if face else "readonly",
                },
                "stroke": {
                    "color": stroke_state,
                    "width": width_state,
                    "opacity": "editable",
                },
                "appearance": {
                    "visible": "editable",
                    "opacity": "editable",
                    "zIndex": "editable",
                },
            },
        )

    def _reflect_container(
        self, container: Any, consumed: set[int], node_id: str
    ) -> Node:
        self._bind(node_id, container)
        kind = type(container).__name__
        self._mark(container, "represented", node_id, kind)
        members = _iter_artists(container)
        for member in members:
            consumed.add(id(member))
            self._mark(member, "consumed", node_id, type(member).__name__)
        label = getattr(container, "get_label", lambda: "Series")() or "Series"
        box = self._bbox(members[0]) if members else None
        line = next((m for m in members if isinstance(m, Line2D)), None)
        if line is not None:
            dpi = float(self._fig_of(line).dpi)
            color = _scalar_hex(line.get_color())
            width = _uniform_width_px(members, dpi)
            dash = _line_dash(line, dpi)
            return Node(
                id=node_id,
                role="series",
                label=label,
                components=Components(
                    stroke=Stroke(
                        color=color, width=width, opacity=_alpha(line), dash=dash
                    ),
                    geometry=Geometry(bbox=box),
                    appearance=Appearance(
                        visible=bool(line.get_visible()),
                        opacity=_alpha(line),
                        zIndex=float(line.get_zorder()),
                    ),
                ),
                editability={
                    "stroke": {
                        "color": "editable" if color else "readonly",
                        "width": "editable" if width is not None else "readonly",
                        "opacity": "editable",
                        "dash": "editable",
                    },
                    "appearance": {
                        "visible": "editable",
                        "opacity": "editable",
                        "zIndex": "editable",
                    },
                },
            )
        faces = [m.get_facecolor() for m in members if hasattr(m, "get_facecolor")]
        face = _uniform_hex(faces)
        fill_state = "editable" if face else "readonly"
        opacity = _alpha(members[0]) if members else 1.0
        return Node(
            id=node_id,
            role="series",
            label=label,
            components=Components(
                fill=Fill(color=face, opacity=opacity),
                geometry=Geometry(bbox=box),
                appearance=Appearance(
                    visible=all(
                        bool(m.get_visible())
                        for m in members
                        if hasattr(m, "get_visible")
                    ),
                    opacity=opacity,
                    zIndex=float(members[0].get_zorder())
                    if members and hasattr(members[0], "get_zorder")
                    else None,
                ),
            ),
            editability={
                "fill": {"color": fill_state, "opacity": fill_state},
                "appearance": {
                    "visible": "editable",
                    "opacity": "editable",
                    "zIndex": "editable",
                },
            },
        )

    def _reflect_legend(self, legend: Legend, consumed: set[int], node_id: str) -> Node:
        self._bind(node_id, legend)
        self._mark(legend, "represented", node_id, "Legend")
        handles = list(getattr(legend, "legend_handles", []) or [])
        texts = list(getattr(legend, "texts", []) or [])
        for item in handles + texts:
            consumed.add(id(item))
            self._mark(item, "consumed", node_id, type(item).__name__)
        if getattr(legend, "legendPatch", None) is not None:
            self._mark(legend.legendPatch, "consumed", node_id, "legendPatch")
        frame = legend.get_frame()
        face = _scalar_hex(frame.get_facecolor()) if frame is not None else None
        return Node(
            id=node_id,
            role="legend",
            label="Legend",
            components=Components(
                geometry=Geometry(bbox=self._bbox(legend)),
                fill=Fill(
                    color=face, opacity=_alpha(frame) if frame is not None else None
                ),
                appearance=Appearance(
                    visible=bool(legend.get_visible()),
                    zIndex=float(legend.get_zorder()),
                ),
            ),
            editability={
                "geometry": {"bbox": "editable"},
                "fill": {"color": "editable" if face else "readonly"},
                "appearance": {"visible": "editable", "zIndex": "editable"},
            },
        )

    def _census_unknown(self, fig: Any) -> None:
        seen = {row.ref for row in self._diagnostics.traversal}

        def walk(obj: Any) -> None:
            if obj is None:
                return
            ref = f"artist:{id(obj)}"
            if ref not in seen:
                self._diagnostics.traversal.append(
                    TraversalEntry(
                        ref=ref, status="unsupported", detail=type(obj).__name__
                    )
                )
                seen.add(ref)
            children = getattr(obj, "get_children", None)
            if not callable(children):
                return
            try:
                items = children()
            except Exception:
                return
            for child in items:
                walk(child)

        walk(fig)

    def diagnostics(self) -> Diagnostics:
        return self._diagnostics

    def workbench_extras(self) -> dict[str, Any]:
        """Host-only path overlays and tabular series data. Not Core Scene."""
        paths: dict[str, list[dict[str, float]]] = {}
        datasets: list[dict[str, Any]] = []
        for node_id, obj in self._handles.items():
            if not isinstance(obj, Line2D):
                continue
            path = self._line_path(obj)
            if len(path) >= 2:
                paths[node_id] = path
            dataset = self._line_dataset(node_id, obj)
            if dataset is not None:
                datasets.append(dataset)
        return {"paths": paths, "datasets": datasets}

    def _line_path(self, line: Line2D) -> list[dict[str, float]]:
        ax = line.axes
        fig = self._fig_of(line)
        if ax is None or fig is None:
            return []
        try:
            xy = line.get_xydata()
        except Exception:
            return []
        if xy is None or len(xy) < 2:
            return []
        try:
            display = ax.transData.transform(xy)
            figure_xy = fig.transFigure.inverted().transform(display)
        except Exception:
            return []
        points: list[dict[str, float]] = []
        for x, y in figure_xy:
            xf, yf = float(x), float(y)
            if not (math.isfinite(xf) and math.isfinite(yf)):
                continue
            points.append({"x": xf, "y": 1.0 - yf})
        if len(points) > 400:
            step = len(points) / 400.0
            points = [points[int(i * step)] for i in range(400)]
        return points

    def _line_dataset(self, node_id: str, line: Line2D) -> dict[str, Any] | None:
        try:
            xs = [float(v) for v in line.get_xdata()]
            ys = [float(v) for v in line.get_ydata()]
        except Exception:
            return None
        pairs = [
            (x, y)
            for x, y in zip(xs, ys, strict=False)
            if math.isfinite(x) and math.isfinite(y)
        ]
        if not pairs:
            return None
        ax = line.axes
        x_name = (ax.get_xlabel() if ax is not None else "") or "x"
        y_name = (ax.get_ylabel() if ax is not None else "") or "y"
        return {
            "nodeId": node_id,
            "label": line.get_label() or "Series",
            "columns": [
                {"name": x_name, "values": [p[0] for p in pairs]},
                {"name": y_name, "values": [p[1] for p in pairs]},
            ],
        }

    def render(self) -> View:
        from io import StringIO

        buf = StringIO()
        self._fig.savefig(buf, format="svg")
        return View(kind="svg", svg=buf.getvalue())

    def export(self, fmt: str) -> bytes:
        from io import BytesIO

        kind = fmt.lower().lstrip(".")
        if kind not in {"svg", "pdf", "png"}:
            raise ValueError(f"unsupported export format {fmt}")
        buf = BytesIO()
        self._fig.savefig(buf, format=kind)
        return buf.getvalue()

    def render_pdf(self) -> bytes:
        return self.export("pdf")

    def _label_text(self, handle: Any) -> MplText | None:
        if isinstance(handle, MplText):
            return handle
        if isinstance(handle, MplAxis):
            label = handle.get_label()
            return label if isinstance(label, MplText) else None
        return None

    def _apply_bbox(self, handle: Any, box: BBox) -> None:
        if isinstance(handle, Legend):
            self._apply_legend_bbox(handle, box)
            return
        if isinstance(handle, Axes):
            self._apply_panel_bbox(handle, box)
            return
        text = self._label_text(handle)
        if text is not None:
            self._translate_text(text, box)
            return
        raise ValueError(f"no bbox setter for {type(handle).__name__}")

    def _apply_legend_bbox(self, legend: Legend, box: BBox) -> None:
        fig = self._fig_of(legend)
        if hasattr(legend, "set_in_layout"):
            legend.set_in_layout(False)
        if hasattr(legend, "set_loc"):
            legend.set_loc("upper left")
        else:
            legend._loc = 2
        anchor_x, anchor_y = box.x, 1.0 - box.y
        for _ in range(3):
            legend.set_bbox_to_anchor((anchor_x, anchor_y), transform=fig.transFigure)
            self._ensure_drawn(fig)
            actual = self._bbox(legend)
            if actual is None:
                return
            dx = box.x - actual.x
            dy_down = box.y - actual.y
            if abs(dx) < 1e-3 and abs(dy_down) < 1e-3:
                return
            anchor_x += dx
            anchor_y -= dy_down

    def _apply_panel_bbox(self, ax: Axes, box: BBox) -> None:
        if hasattr(ax, "set_in_layout"):
            ax.set_in_layout(False)
        x = box.x
        y_up = 1.0 - box.y - box.h
        w, h = box.w, box.h
        for _ in range(3):
            ax.set_position([x, y_up, w, h])
            self._ensure_drawn(self._fig_of(ax))
            actual = self._bbox(ax)
            if actual is None:
                return
            dx = box.x - actual.x
            dy_down = box.y - actual.y
            dw = box.w - actual.w
            dh = box.h - actual.h
            if max(abs(dx), abs(dy_down), abs(dw), abs(dh)) < 1e-3:
                return
            x += dx
            y_up -= dy_down
            w += dw
            h += dh

    def _freeze_text_pos(self, text: MplText) -> None:
        if hasattr(text, "set_in_layout"):
            text.set_in_layout(False)
        ax = text.axes
        if ax is None:
            return
        if text is getattr(ax, "title", None):
            ax._autotitlepos = False
            return
        if text is ax.xaxis.get_label():
            ax.xaxis._autolabelpos = False
        elif text is ax.yaxis.get_label():
            ax.yaxis._autolabelpos = False

    def _nudge_text(self, text: MplText, new_box: BBox) -> bool:
        old = self._bbox(text)
        fig = self._fig_of(text)
        if old is None:
            text.set_transform(fig.transFigure)
            text.set_position((new_box.x, 1.0 - new_box.y))
            return False
        if abs(old.x - new_box.x) < 1e-3 and abs(old.y - new_box.y) < 1e-3:
            return True
        self._ensure_drawn(fig)
        renderer = fig.canvas.get_renderer()
        fig_bb = fig.get_window_extent(renderer)
        dx_px = (new_box.x - old.x) * fig_bb.width
        dy_px = -((new_box.y - old.y) * fig_bb.height)
        trans = text.get_transform()
        x, y = text.get_position()
        disp = trans.transform((x, y))
        nx, ny = trans.inverted().transform((disp[0] + dx_px, disp[1] + dy_px))
        text.set_position((float(nx), float(ny)))
        return False

    def _translate_text(self, text: MplText, new_box: BBox) -> None:
        self._freeze_text_pos(text)
        self._ensure_drawn(self._fig_of(text))
        for _ in range(3):
            if self._nudge_text(text, new_box):
                return
            self._ensure_drawn(self._fig_of(text))

    def _apply_typography(self, text: MplText, prop: str, value: Any) -> None:
        if prop == "size":
            size = parse_size(value)
            if size is None:
                raise ValueError("size")
            text.set_fontsize(size)
        elif prop == "color":
            hex_ = normalize_hex(value)
            if hex_ is None:
                raise ValueError("color")
            text.set_color(hex_)
        elif prop == "family":
            name = parse_name(value)
            if name is None:
                raise ValueError("family")
            text.set_fontname(name)
        elif prop == "weight":
            name = parse_name(value)
            if name is None:
                raise ValueError("weight")
            text.set_fontweight(name)
        elif prop == "style":
            name = parse_name(value)
            if name is None:
                raise ValueError("style")
            text.set_fontstyle(name)
        else:
            raise ValueError(prop)

    def _appearance_targets(self, handle: Any) -> list[Any]:
        if isinstance(handle, (BarContainer, ErrorbarContainer, StemContainer)):
            return [
                item for item in _iter_artists(handle) if hasattr(item, "set_visible")
            ]
        return [handle]

    def _stroke_targets(self, handle: Any) -> list[Any]:
        if isinstance(handle, (Line2D, Collection)):
            return [handle]
        if isinstance(handle, (ErrorbarContainer, StemContainer, BarContainer)):
            return [
                item
                for item in _iter_artists(handle)
                if isinstance(item, (Line2D, Collection))
            ]
        return []

    def _fill_targets(self, handle: Any) -> list[Any]:
        if isinstance(handle, Legend):
            frame = handle.get_frame()
            return [frame] if frame is not None else []
        if isinstance(handle, (Figure, Axes)):
            patch = getattr(handle, "patch", None)
            return [patch] if patch is not None else []
        if isinstance(handle, Collection):
            return [handle]
        if isinstance(handle, (BarContainer, ErrorbarContainer, StemContainer)):
            return [
                item
                for item in _iter_artists(handle)
                if hasattr(item, "set_facecolor") and not isinstance(item, Line2D)
            ]
        return []

    def _apply_appearance(self, handle: Any, prop: str, value: Any) -> None:
        targets = self._appearance_targets(handle)
        if not targets:
            raise ValueError(prop)
        if prop == "visible":
            flag = parse_bool(value)
            if flag is None:
                raise ValueError("visible")
            for artist in targets:
                artist.set_visible(flag)
            return
        if prop == "opacity":
            opacity = parse_opacity(value)
            if opacity is None:
                raise ValueError("opacity")
            for artist in targets:
                if hasattr(artist, "set_alpha"):
                    artist.set_alpha(opacity)
            return
        if prop == "zIndex":
            z_index = float(value)
            for artist in targets:
                if hasattr(artist, "set_zorder"):
                    artist.set_zorder(z_index)
            return
        raise ValueError(prop)

    def _apply_stroke(self, artist: Any, prop: str, value: Any) -> None:
        dpi = float(self._fig_of(artist).dpi)
        if prop == "color":
            hex_ = normalize_hex(value)
            if hex_ is None:
                raise ValueError("color")
            if isinstance(artist, Line2D):
                artist.set_color(hex_)
            elif isinstance(artist, Collection) or hasattr(artist, "set_edgecolor"):
                artist.set_edgecolor(hex_)
            else:
                raise ValueError("color")
            return
        if prop == "width":
            size = parse_size(value)
            if size is None:
                raise ValueError("width")
            points = _px_to_pt(size, dpi)
            if isinstance(artist, Collection) or hasattr(artist, "set_linewidth"):
                artist.set_linewidth(points)
            else:
                raise ValueError("width")
            return
        if prop == "opacity":
            opacity = parse_opacity(value)
            if opacity is None:
                raise ValueError("opacity")
            artist.set_alpha(opacity)
            return
        if prop == "dash":
            dash = parse_dash(value)
            if dash is None:
                raise ValueError("dash")
            if not isinstance(artist, Line2D):
                raise ValueError("dash")
            _set_line_dash(artist, dash, dpi)
            return
        raise ValueError(prop)

    def apply(self, command: Command, request_id: str) -> ApplyResult:
        if command.type != "set":
            return not_implemented(request_id, command.type)
        scene = self.reflect()
        err = check_set_command(scene, command, self._rev)
        if err is not None:
            return fail(request_id, err.code, err.message)
        handle = self._handles.get(command.node_id)
        if handle is None:
            return fail(request_id, "unknown_node", command.node_id)
        try:
            self._apply_set(handle, command.component, command.property, command.value)
            if isinstance(handle, Line2D):
                self._sync_legend(handle)
        except Exception as exc:
            return fail(request_id, "apply_failed", str(exc))
        self._ensure_drawn(self._fig_of(handle))
        if find_node(self.reflect().root, command.node_id) is None:
            return fail(request_id, "apply_failed", "node vanished after apply")
        self._rev += 1
        return ok(request_id, render_result(self, request_id))

    def _apply_set(self, handle: Any, component: str, prop: str, value: Any) -> None:
        if component == "stroke":
            targets = self._stroke_targets(handle)
            if not targets:
                raise ValueError(prop)
            applied = 0
            last_error: Exception | None = None
            for artist in targets:
                try:
                    self._apply_stroke(artist, prop, value)
                    applied += 1
                except ValueError as exc:
                    last_error = exc
            if applied == 0:
                raise last_error or ValueError(prop)
            return
        if component == "fill":
            targets = self._fill_targets(handle)
            if not targets:
                raise ValueError(prop)
            if prop == "color":
                hex_ = normalize_hex(value)
                if hex_ is None:
                    raise ValueError("color")
                for artist in targets:
                    artist.set_facecolor(hex_)
                return
            if prop == "opacity":
                opacity = parse_opacity(value)
                if opacity is None:
                    raise ValueError("opacity")
                for artist in targets:
                    artist.set_alpha(opacity)
                return
            raise ValueError(prop)
        if component == "marker":
            self._apply_marker(handle, prop, value)
            return
        if component == "text":
            if isinstance(handle, Line2D) and prop == "content":
                handle.set_label(str(value))
                return
            text = self._label_text(handle)
            if text is None or prop != "content":
                raise ValueError(prop)
            text.set_text(str(value))
            if isinstance(handle, MplAxis):
                handle.set_label_text(str(value))
            return
        if component == "typography":
            text = self._label_text(handle)
            if text is None:
                raise ValueError(prop)
            self._apply_typography(text, prop, value)
            return
        if component == "geometry" and prop == "bbox":
            box = parse_bbox(value)
            if box is None:
                raise ValueError("bbox")
            self._apply_bbox(handle, box)
            return
        if component == "layout":
            self._apply_layout(handle, prop, value)
            return
        if component == "axis":
            self._apply_axis(handle, prop, value)
            return
        if component == "appearance":
            self._apply_appearance(handle, prop, value)
            return
        raise ValueError(f"no setter for {component}.{prop}")

    def _apply_marker(self, handle: Any, prop: str, value: Any) -> None:
        if not isinstance(handle, Line2D):
            raise ValueError(prop)
        if prop == "shape":
            name = parse_name(value)
            if name is None:
                raise ValueError("shape")
            handle.set_marker("None" if name.lower() == "none" else name)
            return
        if prop == "size":
            size = parse_size(value)
            if size is None:
                raise ValueError("size")
            handle.set_markersize(size)
            return
        if prop == "color":
            hex_ = normalize_hex(value)
            if hex_ is None:
                raise ValueError("color")
            handle.set_markerfacecolor(hex_)
            handle.set_markeredgecolor(hex_)
            return
        raise ValueError(prop)

    def _sync_legend(self, artist: Any) -> None:
        ax = getattr(artist, "axes", None)
        if not isinstance(ax, Axes):
            return
        legend = ax.get_legend()
        if legend is None:
            return
        box = self._bbox(legend)
        loc = getattr(legend, "_loc", 0)
        title_artist = legend.get_title()
        title = title_artist.get_text() if title_artist is not None else ""
        kwargs: dict[str, Any] = {"frameon": bool(legend.get_frame_on())}
        if title:
            kwargs["title"] = title
        if isinstance(loc, (int, str)):
            kwargs["loc"] = loc
        new = ax.legend(**kwargs)
        if box is not None and new is not None:
            self._apply_legend_bbox(new, box)

    def _apply_layout(self, handle: Any, prop: str, value: Any) -> None:
        if isinstance(handle, Figure):
            size = parse_size(value)
            if size is None:
                raise ValueError(prop)
            width, height = (float(v) for v in handle.get_size_inches())
            if prop == "width":
                handle.set_size_inches(size, height, forward=True)
                return
            if prop == "height":
                handle.set_size_inches(width, size, forward=True)
                return
            raise ValueError(prop)
        if isinstance(handle, Axes):
            if not is_finite_number(value):
                raise ValueError(prop)
            number = float(value)
            xmin, xmax = (float(v) for v in handle.get_xlim())
            ymin, ymax = (float(v) for v in handle.get_ylim())
            if prop == "xMin":
                handle.set_xlim(number, xmax)
                return
            if prop == "xMax":
                handle.set_xlim(xmin, number)
                return
            if prop == "yMin":
                handle.set_ylim(number, ymax)
                return
            if prop == "yMax":
                handle.set_ylim(ymin, number)
                return
            raise ValueError(prop)
        raise ValueError(prop)

    def _apply_axis(self, handle: Any, prop: str, value: Any) -> None:
        if not isinstance(handle, MplAxis):
            raise ValueError(prop)
        ax = handle.axes
        if ax is None:
            raise ValueError(prop)
        name = _axis_name(handle, ax)
        if prop in {"min", "max"}:
            if not is_finite_number(value):
                raise ValueError(prop)
            number = float(value)
            lo, hi = (float(v) for v in handle.get_view_interval())
            if prop == "min":
                lo = number
            else:
                hi = number
            if name == "x":
                ax.set_xlim(lo, hi)
            else:
                ax.set_ylim(lo, hi)
            return
        if prop == "ticks":
            ticks = parse_ticks(value)
            if ticks is None:
                raise ValueError("ticks")
            handle.set_ticks(ticks)
            return
        if prop == "tickLabels":
            labels = parse_tick_labels(value)
            if labels is None:
                raise ValueError("tickLabels")
            if not labels:
                _set_axis_formatter(handle, "auto")
                return
            ticks = [float(v) for v in handle.get_majorticklocs()]
            if len(labels) != len(ticks):
                raise ValueError("tickLabels")
            handle.set_ticks(ticks)
            handle.set_ticklabels(labels)
            return
        if prop == "format":
            kind = parse_name(value)
            if kind is None or kind not in _AXIS_FORMATS:
                raise ValueError("format")
            _set_axis_formatter(handle, kind)
            return
        if prop == "scale":
            kind = parse_name(value)
            if kind is None or kind not in _AXIS_SCALES:
                raise ValueError("scale")
            if name == "x":
                ax.set_xscale(kind)
            else:
                ax.set_yscale(kind)
            return
        raise ValueError(prop)
