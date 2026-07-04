"""Mark encoders — the interpreter's emit pass.

One encoder per Vega-Lite mark type, registered in :data:`MARK_ENCODERS`. Each
reads *typed channels* off the unit (``enc["x"].field``) rather than hardcoded
field names, so the same encoder serves any spec that uses the mark. Every
encoder returns whether it drew legend-eligible (labelled) artists.

Adding a mark = write an encoder and register it here.
"""

from __future__ import annotations

from typing import Any

from .data import apply_transforms, as_number, is_temporal
from .model import Unit
from .scales import color_map, numeric_map


def _draw_line(ax: Any, rows: list[dict], enc: dict, mark: dict) -> bool:
    xf = enc["x"].field
    yf = enc["y"].field
    color = enc.get("color")
    cf = color.field if color else None
    cmap = color_map(color)
    detail = enc.get("detail")
    df = detail.field if detail else None
    width_map = numeric_map(enc.get("strokeWidth"))
    op_map = numeric_map(enc.get("opacity"))
    uniform_width = mark.get("strokeWidth")
    uniform_opacity = mark.get("opacity")

    # A polyline per (colour, detail) pair: detail splits series that share a
    # legend colour (e.g. repeated runs) without merging their points.
    groups: dict[Any, list[dict]] = {}
    order: list[Any] = []
    for r in rows:
        key = (r.get(cf) if cf else None, r.get(df) if df else None)
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(r)

    labelled = False
    seen_labels: set = set()
    for cval, _dval in order:
        grp = sorted(groups[(cval, _dval)], key=lambda r: r[xf])
        color_v = cmap.mapping.get(cval) if cmap.kind == "nominal" else None
        lw = width_map.get(cval) if width_map else uniform_width
        alpha = op_map.get(cval) if op_map else uniform_opacity
        # Same colour → one merged legend entry (mirrors Vega legend merging).
        label = str(cval) if cval is not None and cval not in seen_labels else None
        if label is not None:
            seen_labels.add(cval)
        ax.plot(
            [r[xf] for r in grp],
            [r[yf] for r in grp],
            label=label,
            color=color_v,
            linewidth=lw,
            alpha=alpha,
        )
        labelled = labelled or cval is not None
    return labelled


def _draw_point(ax: Any, rows: list[dict], enc: dict, mark: dict) -> bool:
    if not rows:
        return False
    xf = enc["x"].field
    yf = enc["y"].field
    color = enc.get("color")
    cf = color.field if color else None
    cmap = color_map(color)
    xs = [r[xf] for r in rows]
    ys = [r[yf] for r in rows]
    size = mark.get("size", 36)
    alpha = mark.get("opacity")
    if cmap.kind == "quantitative" and cf:
        sc = ax.scatter(xs, ys, c=[r[cf] for r in rows], cmap=cmap.mapping, s=size, alpha=alpha)
        if color.wants_legend:
            ax.figure.colorbar(sc, ax=ax)
    elif cmap.kind == "nominal" and cf:
        ax.scatter(xs, ys, c=[cmap.mapping.get(r[cf]) for r in rows], s=size, alpha=alpha)
    elif cmap.kind == "literal" and cf:
        ax.scatter(xs, ys, c=[r[cf] for r in rows], s=size, alpha=alpha)
    else:
        ax.scatter(xs, ys, color=mark.get("color"), s=size, alpha=alpha)
    return False


def _draw_bar(ax: Any, rows: list[dict], enc: dict, mark: dict) -> bool:
    import numpy as np

    x, y = enc.get("x"), enc.get("y")
    horizontal = y is not None and y.type == "nominal"
    cat_ch = y if horizontal else x
    val_ch = x if horizontal else y
    cat_f, val_f = cat_ch.field, val_ch.field
    color = enc.get("color")
    color_field = color.field if color else None
    cmap = color_map(color)
    stacked = bool(val_ch.stack)
    grouped = "xOffset" in enc or "yOffset" in enc
    opacity = enc.get("opacity")
    overlay_alpha = opacity.value if (opacity is not None and opacity.is_value) else None

    cats = list(dict.fromkeys(r[cat_f] for r in rows))
    keys = list(dict.fromkeys(r[color_field] for r in rows)) if color_field else [None]
    cat_idx = {c: i for i, c in enumerate(cats)}
    pos = np.arange(len(cats), dtype=float)
    bottoms = np.zeros(len(cats))
    band = 0.8
    bar_w = band / max(1, len(keys)) if grouped else band

    for gi, key in enumerate(keys):
        vals = np.zeros(len(cats))
        for r in rows:
            if color_field and r[color_field] != key:
                continue
            vals[cat_idx[r[cat_f]]] = r[val_f]
        color_v = cmap.mapping.get(key) if cmap.kind == "nominal" else None
        label = None if key is None else str(key)
        offs = pos - band / 2 + bar_w * (gi + 0.5) if grouped else pos
        if horizontal:
            ax.barh(offs, vals, height=bar_w, left=bottoms if stacked else None, color=color_v, label=label, alpha=overlay_alpha)
        else:
            ax.bar(offs, vals, width=bar_w, bottom=bottoms if stacked else None, color=color_v, label=label, alpha=overlay_alpha)
        if stacked:
            bottoms += vals

    if horizontal:
        ax.set_yticks(pos)
        ax.set_yticklabels([str(c) for c in cats])
    else:
        ax.set_xticks(pos)
        ax.set_xticklabels([str(c) for c in cats])
    return bool(color_field)


def _draw_interval(ax: Any, rows: list[dict], enc: dict, mark: dict) -> bool:
    """A bar with an ``x2`` (or ``y2``) span — the Gantt case, generalized: a
    bar whose start and end both come from data instead of a baseline."""
    if not rows:
        return False
    color = enc.get("color")
    color_field = color.field if color else None
    cmap = color_map(color)
    opacity = enc.get("opacity")
    op_field = opacity.field if opacity else None
    op_map = numeric_map(opacity)
    y = enc.get("y")
    y_field = y.field if y and y.field else "label"
    labels = list(y.sort) if (y and y.sort) else list(dict.fromkeys(r[y_field] for r in rows))
    ypos = {lbl: i for i, lbl in enumerate(labels)}
    xf = enc["x"].field if enc.get("x") else "start"
    x2f = enc["x2"].field if enc.get("x2") else "end"

    seen: set = set()
    for r in rows:
        start, end = as_number(r[xf]), as_number(r[x2f])
        color_v = cmap.mapping.get(r.get(color_field)) if cmap.kind == "nominal" else None
        alpha = op_map.get(r.get(op_field)) if op_map else None
        group = r.get(color_field)
        label = None if group in seen or group is None else str(group)
        ax.barh(ypos[r[y_field]], end - start, left=start, height=0.6, color=color_v, alpha=alpha, label=label)
        seen.add(group)

    ax.set_yticks(range(len(labels)))
    ax.set_yticklabels([str(lbl) for lbl in labels])
    if rows and is_temporal(rows[0][xf]):
        import matplotlib.dates as mdates

        ax.xaxis.set_major_formatter(mdates.DateFormatter("%H:%M"))
    return bool(color_field)


def _draw_bar_or_interval(ax: Any, rows: list[dict], enc: dict, mark: dict) -> bool:
    if "x2" in enc or "y2" in enc:
        return _draw_interval(ax, rows, enc, mark)
    return _draw_bar(ax, rows, enc, mark)


MARK_ENCODERS = {
    "line": _draw_line,
    "point": _draw_point,
    "circle": _draw_point,
    "square": _draw_point,
    "bar": _draw_bar_or_interval,
}


def encode(ax: Any, unit: Unit) -> bool:
    """Draw one unit's mark; returns whether it produced labelled artists.
    Unknown marks are skipped (returns False)."""
    encoder = MARK_ENCODERS.get(unit.mark)
    if encoder is None:
        return False
    rows = apply_transforms(unit.rows, unit.transforms)
    return encoder(ax, rows, unit.encoding, unit.mark_props)
