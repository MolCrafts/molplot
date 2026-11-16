"""An editable Matplotlib figure session, reused by the multi-figure host."""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

from molplot.engines.matplotlib import MatplotlibEngine
from molplot.host.style import (
    LATEX_HINT,
    SCRIPT_SOURCE,
    StyleError,
    apply_source,
    disable_usetex,
    is_latex_error,
)
from molplot.host.style import payload as style_payload
from molplot.semantic.codec import apply_result_to_json, render_result_to_json
from molplot.semantic.engine import fail, ok, render_result

logger = logging.getLogger(__name__)


class Session:
    def __init__(
        self, fig: Any, script: str | None, figure_index: int | None = None
    ) -> None:
        import matplotlib as mpl

        self.rc = mpl.rcParams.copy()
        self.figure_index = figure_index
        self.engine = MatplotlibEngine(fig)
        self.script = script
        self.lock = threading.Lock()
        self.style_source = SCRIPT_SOURCE
        self.style_name = SCRIPT_SOURCE

    @property
    def stem(self) -> str:
        if self.script:
            stem = Path(self.script).stem
            return (
                f"{stem}-{self.figure_index + 1}"
                if self.figure_index is not None
                else stem
            )
        return "figure"

    def _decorate(self, payload: dict[str, Any]) -> dict[str, Any]:
        payload["script"] = self.script
        payload["figureCount"] = len(getattr(self.engine, "_figs", [None]))
        payload.update(self.engine.workbench_extras())
        payload["style"] = style_payload(self.style_source, self.style_name)
        return payload

    def _render_json(self, request_id: str) -> dict[str, Any]:
        try:
            return render_result_to_json(render_result(self.engine, request_id))
        except Exception as exc:
            if not is_latex_error(exc):
                raise
            disable_usetex()
            return render_result_to_json(render_result(self.engine, request_id))

    def result_payload(self, request_id: str) -> dict[str, Any]:
        return self._decorate(self._render_json(request_id))

    def apply_style(
        self,
        request_id: str,
        source: str,
        name: str,
        rc: dict[str, Any] | None,
    ) -> dict[str, Any]:
        script = self.script
        if not script or not Path(script).is_file():
            payload = apply_result_to_json(
                fail(request_id, "apply_failed", "No figure script to reload.")
            )
            payload["script"] = self.script
            return payload
        import matplotlib as mpl
        import matplotlib.pyplot as plt

        from molplot.host.figures import load_script

        previous_rc = mpl.rcParams.copy()
        previous_source = self.style_source
        previous_name = self.style_name
        try:
            apply_source(source, name, rc if isinstance(rc, dict) else None)
            figs = load_script(script)
            if self.figure_index is not None:
                if self.figure_index >= len(figs):
                    for fig in figs:
                        plt.close(fig)
                    raise RuntimeError("The script no longer creates this figure.")
                chosen = figs[self.figure_index]
                for fig in figs:
                    if fig is not chosen:
                        plt.close(fig)
                figs = [chosen]
        except StyleError as exc:
            mpl.rcParams.update(previous_rc)
            self.style_source = previous_source
            self.style_name = previous_name
            payload = apply_result_to_json(fail(request_id, exc.code, exc.message))
            payload["script"] = self.script
            return payload
        except Exception as exc:  # noqa: BLE001 -- user scripts and renderers can raise any exception.
            mpl.rcParams.update(previous_rc)
            self.style_source = previous_source
            self.style_name = previous_name
            if is_latex_error(exc):
                disable_usetex()
                payload = apply_result_to_json(
                    fail(request_id, "apply_failed", LATEX_HINT)
                )
            else:
                payload = apply_result_to_json(
                    fail(request_id, "apply_failed", str(exc))
                )
            payload["script"] = self.script
            return payload
        old_figs = list(getattr(self.engine, "_figs", []))
        new_engine = MatplotlibEngine(figs, revision=self.engine.revision() + 1)
        try:
            rendered = render_result(new_engine, request_id)
        except Exception as exc:  # noqa: BLE001 -- user scripts and renderers can raise any exception.
            mpl.rcParams.update(previous_rc)
            self.style_source = previous_source
            self.style_name = previous_name
            if is_latex_error(exc):
                disable_usetex()
                payload = apply_result_to_json(
                    fail(request_id, "apply_failed", LATEX_HINT)
                )
            else:
                payload = apply_result_to_json(
                    fail(request_id, "apply_failed", str(exc))
                )
            payload["script"] = self.script
            for fig in figs:
                try:
                    plt.close(fig)
                except Exception:
                    logger.exception("Could not close a failed style preview")
            return payload
        self.rc = mpl.rcParams.copy()
        self.engine = new_engine
        self.style_source = source
        self.style_name = name if source != "custom" else "custom"
        for fig in old_figs:
            try:
                plt.close(fig)
            except Exception:
                logger.exception("Could not close a replaced figure")
        payload = apply_result_to_json(ok(request_id, rendered))
        payload["script"] = self.script
        if payload.get("result"):
            self._decorate(payload["result"])
        return payload
