"""`molplot serve [script.py ...]` starts or reuses one figure workbench."""

from __future__ import annotations

import argparse
import socket
import webbrowser
from contextlib import asynccontextmanager
from pathlib import Path


def _serve(args: argparse.Namespace) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import uvicorn

    from molplot.host.discovery import (
        append_existing,
        discovery_path,
        endpoint,
        forget,
        publish,
    )
    from molplot.host.server import create_app
    from molplot.host.workspace import Workspace

    scripts = [str(Path(script).resolve(strict=True)) for script in args.scripts]
    url = endpoint(args.host, args.port)
    reused = append_existing(args.host, args.port, scripts, str(Path.cwd()))
    if reused is not None:
        print(f"MolPlot  {url}/ (existing workbench)")
        print(
            f"Added {len(reused.get('added', []))} figure(s); {len(reused['figures'])} total. See Figures in the open workbench."
        )
        return

    # Reserve the address before executing scripts. Never replace an unrelated service.
    try:
        listener = socket.create_server(
            (args.host, args.port),
            family=socket.AF_INET6 if ":" in args.host else socket.AF_INET,
        )
    except OSError as exc:
        raise RuntimeError(
            f"Cannot start MolPlot at {url}: the address is unavailable. Use --port to choose another workbench."
        ) from exc
    workspace = Workspace()
    path = discovery_path(args.host, args.port)
    try:
        if scripts:
            workspace.add_scripts(scripts, str(Path.cwd()))

        @asynccontextmanager
        async def lifespan(_app):
            try:
                yield
            finally:
                forget(path, workspace.instance_id)

        app = create_app(workspace, lifespan=lifespan)
        publish(path, url, workspace.instance_id, workspace.token)
        print(f"MolPlot  {url}/", flush=True)
        print(
            "Run molplot serve <another.py> with the same host/port to add figures here.",
            flush=True,
        )
        if not args.no_open:
            webbrowser.open(f"{url}/")
        server = uvicorn.Server(
            uvicorn.Config(app, host=args.host, port=args.port, log_level="info")
        )
        server.run(sockets=[listener])
    finally:
        forget(path, workspace.instance_id)
        listener.close()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="molplot")
    sub = parser.add_subparsers(dest="command", required=True)
    serve = sub.add_parser(
        "serve", help="Start or reuse a workbench; add figures from Python scripts."
    )
    serve.add_argument(
        "scripts",
        nargs="*",
        help="Python files assigning fig / figure / figs or using pyplot",
    )
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8765)
    serve.add_argument("--no-open", action="store_true")
    serve.set_defaults(func=_serve)
    args = parser.parse_args(argv)
    try:
        args.func(args)
    except (OSError, RuntimeError) as exc:
        parser.exit(1, f"molplot: {exc}\n")
