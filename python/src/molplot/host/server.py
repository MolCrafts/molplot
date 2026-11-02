"""FastAPI workbench around one MatplotlibEngine session."""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from molplot.engines.matplotlib import MatplotlibEngine
from molplot.host.style import (
    LATEX_HINT,
    SCRIPT_SOURCE,
    StyleError,
    apply_source,
    disable_usetex,
    is_latex_error,
)
from molplot.host.style import (
    payload as style_payload,
)
from molplot.semantic.codec import (
    apply_result_to_json,
    command_from_json,
    render_result_to_json,
)
from molplot.semantic.engine import fail, ok, render_result

STATIC = Path(__file__).parent / "static"
DIST = Path(__file__).parent / "dist"
ASSET_DIRS = ("js", "css", "assets", "image", "font", "svg")
EXPORT_MEDIA = {
    "svg": "image/svg+xml",
    "pdf": "application/pdf",
    "png": "image/png",
}


class Session:
    def __init__(self, fig: Any, script: str | None) -> None:
        self.engine = MatplotlibEngine(fig)
        self.script = script
        self.lock = threading.Lock()
        self.style_source = SCRIPT_SOURCE
        self.style_name = SCRIPT_SOURCE

    @property
    def stem(self) -> str:
        if self.script:
            return Path(self.script).stem
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
        except StyleError as exc:
            mpl.rcParams.update(previous_rc)
            self.style_source = previous_source
            self.style_name = previous_name
            payload = apply_result_to_json(fail(request_id, exc.code, exc.message))
            payload["script"] = self.script
            return payload
        except Exception as exc:
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
        new_engine = MatplotlibEngine(figs)
        try:
            rendered = render_result(new_engine, request_id)
        except Exception as exc:
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
                    pass
            return payload
        self.engine = new_engine
        self.style_source = source
        self.style_name = name if source != "custom" else "custom"
        for fig in old_figs:
            try:
                plt.close(fig)
            except Exception:
                pass
        payload = apply_result_to_json(ok(request_id, rendered))
        payload["script"] = self.script
        if payload.get("result"):
            self._decorate(payload["result"])
        return payload


class CommandRequest(BaseModel):
    requestId: str = "apply"
    command: dict[str, Any] = Field(default_factory=dict)


def page_index() -> Path:
    dist_index = DIST / "index.html"
    if dist_index.is_file():
        return dist_index
    return STATIC / "index.html"


def create_app(session: Session) -> FastAPI:
    app = FastAPI(title="MolPlot", docs_url="/api/docs", redoc_url=None)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(page_index())

    @app.get("/api/result")
    def get_result(
        request_id: str = Query("result", alias="requestId"),
    ) -> dict[str, Any]:
        with session.lock:
            return session.result_payload(request_id)

    @app.post("/api/commands")
    def post_command(body: CommandRequest) -> dict[str, Any]:
        raw = body.command or {}
        if raw.get("type") == "style":
            rc = raw.get("rc")
            with session.lock:
                return session.apply_style(
                    body.requestId,
                    str(raw.get("source") or ""),
                    str(raw.get("name") or ""),
                    rc if isinstance(rc, dict) else None,
                )
        try:
            command = command_from_json(raw)
        except (KeyError, TypeError, ValueError) as exc:
            payload = apply_result_to_json(
                fail(body.requestId, "invalid_value", str(exc))
            )
            payload["script"] = session.script
            return payload
        with session.lock:
            result = session.engine.apply(command, body.requestId)
            payload = apply_result_to_json(result)
            payload["script"] = session.script
            if payload.get("result"):
                session._decorate(payload["result"])
            return payload

    @app.get("/api/export/{fmt}")
    def export(
        fmt: str,
        download: bool = False,
        revision: int | None = Query(default=None, alias="r"),
    ) -> Response:
        kind = fmt.lower().lstrip(".")
        media = EXPORT_MEDIA.get(kind)
        if media is None:
            raise HTTPException(status_code=404, detail=f"unsupported format {fmt}")
        with session.lock:
            data = session.engine.export(kind)
            _ = revision
        filename = f"{session.stem}.{kind}"
        disposition = "attachment" if download else "inline"
        return Response(
            content=data,
            media_type=media,
            headers={
                "Cache-Control": "no-store",
                "Content-Disposition": f'{disposition}; filename="{filename}"',
            },
        )

    if DIST.is_dir():
        for name in ASSET_DIRS:
            folder = DIST / name
            if folder.is_dir():
                app.mount(
                    f"/{name}", StaticFiles(directory=folder), name=f"page-{name}"
                )
    return app
