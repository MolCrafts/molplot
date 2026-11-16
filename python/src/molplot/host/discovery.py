"""Private local discovery for repeated `molplot serve` invocations."""

from __future__ import annotations

import getpass
import hashlib
import json
import os
import tempfile
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def endpoint(host: str, port: int) -> str:
    target = (
        "127.0.0.1"
        if host in {"0.0.0.0", "localhost"}
        else "::1"
        if host == "::"
        else host
    )
    return f"http://{'[' + target + ']' if ':' in target else target}:{port}"


def discovery_path(host: str, port: int) -> Path:
    root = Path(
        os.environ.get(
            "MOLPLOT_RUNTIME_DIR",
            Path(tempfile.gettempdir())
            / f"molplot-{getattr(os, 'getuid', getpass.getuser)()}",
        )
    )
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    key = hashlib.sha256(endpoint(host, port).encode()).hexdigest()[:16]
    return root / f"{key}.json"


def publish(path: Path, url: str, instance: str, token: str) -> None:
    fd, temporary = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, "w") as output:
            json.dump({"url": url, "instance": instance, "token": token}, output)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def forget(path: Path, instance: str) -> None:
    try:
        if json.loads(path.read_text())["instance"] == instance:
            path.unlink()
    except (OSError, ValueError, KeyError):
        pass


def append_existing(host: str, port: int, scripts: list[str], cwd: str) -> dict | None:
    try:
        data = json.loads(discovery_path(host, port).read_text())
        if data["url"] != endpoint(host, port):
            return None
        with urlopen(f"{data['url']}/api/figures", timeout=2) as response:
            info = json.load(response)
        if (
            info.get("service") != "molplot"
            or info.get("instanceId") != data["instance"]
        ):
            return None
    except (OSError, ValueError, KeyError):
        return None
    if not scripts:
        return info
    request = Request(
        f"{data['url']}/api/figures",
        data=json.dumps({"scripts": scripts, "cwd": cwd}).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {data['token']}",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=120) as response:
            return json.load(response)
    except HTTPError as exc:
        try:
            message = json.load(exc).get("detail", str(exc))
        except ValueError:
            message = str(exc)
        raise RuntimeError(f"Could not add figures: {message}") from exc
