"""A running workbench owns independent figure sessions from any number of scripts."""

from __future__ import annotations

import os
import secrets
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from molplot.host.figures import load_script
from molplot.host.session import Session


class FigureNotFound(LookupError):
    pass


@dataclass
class FigureEntry:
    id: str
    title: str
    session: Session
    cwd: str

    def metadata(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "script": self.session.script,
            "revision": self.session.engine.revision(),
        }


class Workspace:
    """Serialize Matplotlib's process-global state, while keeping every figure's edits and rc independent."""

    def __init__(self, session: Session | None = None) -> None:
        self.lock = threading.RLock()
        self.token = secrets.token_urlsafe(32)
        self.instance_id = secrets.token_hex(16)
        self.entries: dict[str, FigureEntry] = {}
        self.revision = 0
        if session is not None:
            self._entry(
                session,
                Path(session.script).stem if session.script else "Figure",
                os.getcwd(),
            )

    def _entry(self, session: Session, title: str, cwd: str) -> FigureEntry:
        entry = FigureEntry(secrets.token_hex(12), title, session, cwd)
        self.entries[entry.id] = entry
        self.revision += 1
        return entry

    def catalog(self) -> dict[str, Any]:
        with self.lock:
            return {
                "service": "molplot",
                "instanceId": self.instance_id,
                "revision": self.revision,
                "figures": [entry.metadata() for entry in self.entries.values()],
            }

    def add_scripts(
        self, scripts: list[str], cwd: str | None = None
    ) -> list[dict[str, Any]]:
        import matplotlib as mpl
        import matplotlib.pyplot as plt

        with self.lock:
            previous_cwd = os.getcwd()
            before = set(plt.get_fignums())
            staged: list[tuple[Session, str]] = []
            directory = str(Path(cwd or previous_cwd).resolve(strict=True))
            try:
                os.chdir(directory)
                # One script must not change the defaults of the next script or another figure.
                for script in scripts:
                    path = str(Path(script).resolve(strict=True))
                    with mpl.rc_context():
                        figs = load_script(path)
                        for index, fig in enumerate(figs):
                            session = Session(fig, path, index)
                            session.result_payload(
                                "load"
                            )  # refuse broken figures before changing the collection
                            title = fig.get_label() or next(
                                (ax.get_title() for ax in fig.axes if ax.get_title()),
                                "",
                            )
                            staged.append(
                                (session, title or f"{Path(path).stem} · {index + 1}")
                            )
            except BaseException:
                for number in set(plt.get_fignums()) - before:
                    plt.close(number)
                raise
            finally:
                os.chdir(previous_cwd)
            return [
                self._entry(session, title, directory).metadata()
                for session, title in staged
            ]

    @contextmanager
    def operation(self, figure_id: str | None = None) -> Iterator[FigureEntry]:
        import matplotlib as mpl

        with self.lock:
            entry = (
                self.entries.get(figure_id)
                if figure_id
                else next(iter(self.entries.values()), None)
            )
            if entry is None:
                raise FigureNotFound(figure_id or "No figures in this workbench")
            previous_cwd = os.getcwd()
            try:
                os.chdir(entry.cwd)
                with mpl.rc_context(rc=entry.session.rc):
                    yield entry
            finally:
                os.chdir(previous_cwd)
