"""Markdown authoring sugar — a ``molplot`` fenced block for docs.

Lets a documentation author embed a chart by writing a Vega-Lite spec directly
in a fenced code block instead of raw HTML::

    ```molplot
    mark: line
    data:
      values:
        - {step: 0, energy: 1}
        - {step: 1, energy: 2}
    encoding:
      x: {field: step, type: quantitative}
      y: {field: energy, type: quantitative}
    ```

This is a `pymdownx.superfences` *custom fence* formatter — a build-time
**text → text** transform that runs while the site is compiled. It does **not**
draw the chart: it parses the fenced body (a plain Vega-Lite spec, YAML or JSON)
and returns a ``<molplot-chart>`` custom-element string carrying that spec in a
nested ``<script type="application/json">`` block. The browser later upgrades the
element and renders it (the ``@molcrafts/molplot`` ``elements`` bundle registers
``<molplot-chart>``), so the fence is just sugar for the raw element an author
could write by hand.

Wire it up in ``zensical.toml`` (mirrors the mkdocs ``format:
!!python/name:...`` convention)::

    [[markdown_extensions."pymdownx.superfences".custom_fences]]
    name = "molplot"
    class = "molplot"
    format = "!!python/name:molplot.mdx.molplot_fence"

The fence takes optional ``type=...`` / ``preset=...`` / ``theme=...`` options
(``molplot`` / ``molplot-paper`` for ``preset``; ``auto`` / ``light`` / ``dark``
for ``theme``). ``type`` is accepted for author familiarity but the body is a
full Vega-Lite spec, so it is only forwarded as a hint and does not transform
the spec.
"""

from __future__ import annotations

import html
import json
from typing import Any

__all__ = ["molplot_fence", "molplot_validator", "render_element"]

#: Fence-header options the `molplot` custom fence understands.
_ALLOWED_OPTIONS = ("preset", "theme", "type")


def _load_spec(source: str) -> Any:
    """Parse a fenced body (YAML or JSON) into a Vega-Lite spec object.

    YAML is a superset of JSON, so ``yaml.safe_load`` handles both. Falls back
    to ``json`` if PyYAML is unavailable (JSON-only authoring still works).
    """
    try:
        import yaml
    except ImportError:  # pragma: no cover - pyyaml is a doc-group dependency
        return json.loads(source)
    return yaml.safe_load(source)


def render_element(
    source: str,
    *,
    preset: str | None = None,
    theme: str | None = None,
) -> str:
    """Build the ``<molplot-chart>`` HTML for a Vega-Lite ``source`` spec.

    The spec is embedded verbatim (no transformation) in a nested
    ``<script type="application/json">`` block so multiline JSON survives
    Markdown/HTML sanitization. A parse error is surfaced inline rather than
    breaking the build.
    """
    try:
        spec = _load_spec(source)
    except Exception as exc:  # noqa: BLE001 - report any parse error inline
        message = html.escape(f"molplot: invalid Vega-Lite spec — {exc}")
        return f'<div class="molplot-error">{message}</div>'

    attrs = ""
    if preset:
        attrs += f' preset="{html.escape(preset, quote=True)}"'
    if theme:
        attrs += f' theme="{html.escape(theme, quote=True)}"'

    payload = json.dumps(spec)
    # Wrap in a block-level <div> so the emitted HTML is treated as a block by
    # Python-Markdown / md_in_html: no surrounding <p> and no reprocessing of
    # the element's children (which would otherwise mangle the JSON).
    return (
        f'<div class="molplot">'
        f"<molplot-chart{attrs}>"
        f'<script type="application/json">{payload}</script>'
        f"</molplot-chart>"
        f"</div>"
    )


def molplot_validator(
    language: str,
    inputs: dict[str, str],
    options: dict[str, Any],
    attrs: dict[str, Any],
    md: Any,
) -> bool:
    """`pymdownx.superfences` custom-fence validator.

    The default validator rejects any fence-header options, so ``preset=…`` /
    ``theme=…`` / ``type=…`` would fall back to a plain code block. This accepts
    exactly those keys and forwards them to the formatter via ``options``;
    anything else fails validation (so a typo surfaces rather than silently
    vanishing).
    """
    for key, value in inputs.items():
        if key not in _ALLOWED_OPTIONS:
            return False
        options[key] = value
    return True


def molplot_fence(
    source: str,
    language: str,
    css_class: str,
    options: dict[str, Any],
    md: Any,
    **kwargs: Any,
) -> str:
    """`pymdownx.superfences` custom-fence formatter (see the module docstring).

    Signature follows the superfences ``format`` contract; ``options`` holds the
    validated ``key=value`` pairs from the fence header (e.g.
    ``preset=molplot-paper``) that :func:`molplot_validator` allowed through.
    """
    return render_element(
        source,
        preset=options.get("preset"),
        theme=options.get("theme"),
    )
