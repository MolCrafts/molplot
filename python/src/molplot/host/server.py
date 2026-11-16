"""FastAPI host for a reusable, multi-figure workbench."""

from __future__ import annotations

import secrets
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.types import Lifespan

from molplot.host.session import Session  # compatibility for existing embedded hosts
from molplot.host.workspace import FigureNotFound, Workspace
from molplot.semantic.codec import apply_result_to_json, command_from_json
from molplot.semantic.engine import fail

STATIC = Path(__file__).parent / "static"
DIST = Path(__file__).parent / "dist"
ASSET_DIRS = ("js", "css", "assets", "image", "font", "svg")
EXPORT_MEDIA = {"svg": "image/svg+xml", "pdf": "application/pdf", "png": "image/png"}


class CommandRequest(BaseModel):
    requestId: str = "apply"
    figureId: str | None = None
    command: dict[str, Any] = Field(default_factory=dict)


class AddFiguresRequest(BaseModel):
    scripts: list[str] = Field(min_length=1)
    cwd: str | None = None


def page_index() -> Path:
    dist_index = DIST / "index.html"
    return dist_index if dist_index.is_file() else STATIC / "index.html"


def create_app(
    session: Session | Workspace | None = None,
    *,
    lifespan: Lifespan[FastAPI] | None = None,
) -> FastAPI:
    workspace = session if isinstance(session, Workspace) else Workspace(session)
    app = FastAPI(
        title="MolPlot", docs_url="/api/docs", redoc_url=None, lifespan=lifespan
    )
    app.state.workspace = workspace
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
    )

    @app.exception_handler(FigureNotFound)
    async def missing_figure(_request, _exc):
        from fastapi.responses import JSONResponse

        return JSONResponse(status_code=404, content={"detail": "Figure not found"})

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(page_index())

    @app.get("/api/figures")
    def figures() -> dict[str, Any]:
        return workspace.catalog()

    @app.post("/api/figures")
    def add_figures(
        body: AddFiguresRequest, authorization: str = Header(default="")
    ) -> dict[str, Any]:
        # Loading a script executes Python. Only the local CLI holding this host's private capability can add it.
        if not secrets.compare_digest(authorization, f"Bearer {workspace.token}"):
            raise HTTPException(
                status_code=403, detail="Add figures using molplot serve <script.py>."
            )
        try:
            added = workspace.add_scripts(body.scripts, body.cwd)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {**workspace.catalog(), "added": added}

    @app.get("/api/result")
    def get_result(
        request_id: str = Query("result", alias="requestId"), figure: str | None = None
    ) -> dict[str, Any]:
        with workspace.operation(figure) as entry:
            return {**entry.session.result_payload(request_id), "figureId": entry.id}

    @app.post("/api/commands")
    def post_command(body: CommandRequest) -> dict[str, Any]:
        with workspace.operation(body.figureId) as entry:
            current = entry.session
            raw = body.command or {}
            if raw.get("type") == "style":
                rc = raw.get("rc")
                result = current.apply_style(
                    body.requestId,
                    str(raw.get("source") or ""),
                    str(raw.get("name") or ""),
                    rc if isinstance(rc, dict) else None,
                )
            else:
                try:
                    command = command_from_json(raw)
                except (KeyError, TypeError, ValueError) as exc:
                    return apply_result_to_json(
                        fail(body.requestId, "invalid_value", str(exc))
                    )
                result = apply_result_to_json(
                    current.engine.apply(command, body.requestId)
                )
                if result.get("result"):
                    current._decorate(result["result"])
            result["script"] = current.script
            result["figureId"] = entry.id
            if result.get("result"):
                result["result"]["figureId"] = entry.id
            return result

    @app.get("/api/export/{fmt}")
    def export(
        fmt: str,
        download: bool = False,
        revision: int | None = Query(default=None, alias="r"),
        figure: str | None = None,
    ) -> Response:
        kind = fmt.lower().lstrip(".")
        if kind not in EXPORT_MEDIA:
            raise HTTPException(status_code=404, detail=f"unsupported format {fmt}")
        with workspace.operation(figure) as entry:
            data = entry.session.engine.export(kind)
            filename = f"{entry.session.stem}.{kind}"
        return Response(
            content=data,
            media_type=EXPORT_MEDIA[kind],
            headers={
                "Cache-Control": "no-store",
                "Content-Disposition": f'{"attachment" if download else "inline"}; filename="{filename}"',
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
