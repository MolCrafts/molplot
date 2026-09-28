"""MolPlot command line. ``molplot serve script.py`` runs the workbench."""

from __future__ import annotations

import argparse
import webbrowser
from pathlib import Path


def _serve(args: argparse.Namespace) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import uvicorn

    from molplot.host.figures import load_script
    from molplot.host.server import Session, create_app

    script = str(Path(args.script).resolve())
    figs = load_script(script)
    session = Session(figs, script)
    app = create_app(session)
    url = f"http://{args.host}:{args.port}/"
    print(f"MolPlot  {url}")
    print(f"script   {script}")
    print("Export formats are chosen in the workbench, not by the script.")
    if not args.no_open:
        webbrowser.open(url)
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="molplot")
    sub = parser.add_subparsers(dest="command", required=True)

    serve = sub.add_parser(
        "serve",
        help="Open a figure script in the workbench. Assign fig, figure, or figs; do not savefig.",
    )
    serve.add_argument(
        "script",
        help="Python file that assigns fig / figure / figs, or creates figures with pyplot",
    )
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8765)
    serve.add_argument("--no-open", action="store_true")
    serve.set_defaults(func=_serve)

    args = parser.parse_args(argv)
    args.func(args)
