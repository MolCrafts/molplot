"""A workbench keeps scripts, figures, revisions, exports and style state independent."""

import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pytest
from fastapi.testclient import TestClient
from molplot.host.server import create_app
from molplot.host.workspace import Workspace


def teardown_function():
    plt.close("all")


def make_script(tmp_path, name="plots.py", count=2):
    path = tmp_path / name
    path.write_text(
        "import matplotlib.pyplot as plt\nfigs = []\n"
        f"for i in range({count}):\n"
        "    fig, ax = plt.subplots()\n"
        "    ax.plot([0, 1], [i, i + 1], label='curve')\n"
        "    ax.set_title(f'Plot {i + 1}')\n"
        "    figs.append(fig)\n"
    )
    return str(path)


def test_add_edit_switch_export_and_style_are_scoped(tmp_path):
    workspace = Workspace()
    client = TestClient(create_app(workspace))
    script = make_script(tmp_path)
    body = {"scripts": [script], "cwd": str(tmp_path)}
    assert client.get("/api/figures").json()["figures"] == []
    assert client.get("/api/result").status_code == 404
    assert client.post("/api/figures", json=body).status_code == 403
    response = client.post(
        "/api/figures",
        json=body,
        headers={"Authorization": f"Bearer {workspace.token}"},
    )
    first, second = response.json()["added"]
    assert first["id"] != second["id"]
    assert first["title"] == "Plot 1"
    assert client.get("/api/result", params={"figure": "deleted"}).status_code == 404
    assert (
        client.get("/api/export/pdf", params={"figure": "deleted"}).status_code == 404
    )
    assert (
        client.post(
            "/api/commands", json={"figureId": "deleted", "command": {}}
        ).status_code
        == 404
    )
    before = client.get("/api/result", params={"figure": first["id"]}).json()
    command = {
        "type": "set",
        "nodeId": "figure/0/panel/0/series/0",
        "component": "stroke",
        "property": "color",
        "value": "#ff0000",
        "baseRevision": before["revision"],
    }
    changed = client.post(
        "/api/commands", json={"figureId": first["id"], "command": command}
    ).json()
    assert changed["ok"], changed
    assert changed["result"]["revision"] > before["revision"]
    untouched = client.get("/api/result", params={"figure": second["id"]}).json()
    assert untouched["revision"] == before["revision"]
    assert untouched["figureId"] == second["id"]
    assert "#ff0000" not in untouched["view"]["svg"].lower()
    added = workspace.add_scripts([make_script(tmp_path, "next.py", 1)])
    assert len(added) == 1 and len(workspace.catalog()["figures"]) == 3
    retained = client.get("/api/result", params={"figure": first["id"]}).json()
    assert "#ff0000" in retained["view"]["svg"].lower()
    assert retained["revision"] == changed["result"]["revision"]
    for kind, prefix in [("pdf", b"%PDF"), ("png", b"\x89PNG"), ("svg", b"<?xml")]:
        exported = client.get(f"/api/export/{kind}", params={"figure": first["id"]})
        assert exported.content.startswith(prefix)
        assert f"plots-1.{kind}" in exported.headers["content-disposition"]
    previous_rc = plt.rcParams.copy()
    styled = client.post(
        "/api/commands",
        json={
            "figureId": second["id"],
            "command": {"type": "style", "source": "molplot", "name": "molplot"},
        },
    ).json()
    assert styled["ok"], styled
    assert styled["result"]["figureCount"] == 1
    assert styled["result"]["revision"] > untouched["revision"]
    assert styled["result"]["figureId"] == second["id"]
    assert plt.rcParams == previous_rc
    assert (
        client.get("/api/result", params={"figure": first["id"]}).json()["style"][
            "current"
        ]["source"]
        == "script"
    )
    stale = client.post(
        "/api/commands", json={"figureId": second["id"], "command": command}
    ).json()
    assert not stale["ok"] and stale["error"]["code"] == "stale_revision"


def test_failed_batch_keeps_collection_and_cwd(tmp_path):
    workspace = Workspace()
    original = workspace.add_scripts([make_script(tmp_path, "good.py", 1)])
    before = set(plt.get_fignums())
    cwd = os.getcwd()
    bad = tmp_path / "bad.py"
    bad.write_text(
        "import matplotlib.pyplot as plt\nfig, ax = plt.subplots()\nraise RuntimeError('broken')\n"
    )
    with pytest.raises(RuntimeError, match="broken"):
        workspace.add_scripts(
            [make_script(tmp_path, "staged.py", 1), str(bad)], str(tmp_path)
        )
    assert workspace.catalog()["figures"] == original
    assert set(plt.get_fignums()) == before
    assert os.getcwd() == cwd


def test_cli_reuses_running_server(tmp_path):
    # Real subprocess round trip: no discovery mocks or fixed port assumptions.
    with socket.socket() as address:
        address.bind(("127.0.0.1", 0))
        port = address.getsockname()[1]
    runtime = tmp_path / "runtime"
    env = {**os.environ, "MOLPLOT_RUNTIME_DIR": str(runtime)}
    base = [sys.executable, "-m", "molplot", "serve", "--port", str(port), "--no-open"]
    root = Path(__file__).resolve().parents[2]
    log = tmp_path / "server.log"
    with log.open("w") as output:
        server = subprocess.Popen(base, cwd=root, env=env, stdout=output, stderr=output)
        try:
            deadline = time.monotonic() + 20
            while True:
                try:
                    with urlopen(
                        f"http://127.0.0.1:{port}/api/figures", timeout=1
                    ) as response:
                        import json

                        initial = json.load(response)
                    break
                except (OSError, URLError):
                    if server.poll() is not None or time.monotonic() > deadline:
                        pytest.fail(log.read_text())
                    time.sleep(0.05)
            one = subprocess.run(
                [*base, make_script(tmp_path)],
                cwd=root,
                env=env,
                check=False,
                capture_output=True,
                text=True,
                timeout=30,
            )
            assert one.returncode == 0, one.stderr
            assert "existing workbench" in one.stdout and "2 total" in one.stdout
            two = subprocess.run(
                [*base, make_script(tmp_path, "next.py", 1)],
                cwd=root,
                env=env,
                check=False,
                capture_output=True,
                text=True,
                timeout=30,
            )
            assert two.returncode == 0, two.stderr
            with urlopen(f"http://127.0.0.1:{port}/api/figures") as response:
                catalog = json.load(response)
            assert len(catalog["figures"]) == 3
            assert catalog["instanceId"] == initial["instanceId"]
            assert server.poll() is None
            assert not any(
                path.stat().st_mode & 0o077 for path in runtime.glob("*.json")
            )
        finally:
            server.terminate()
            server.wait(timeout=10)
    assert not list(runtime.glob("*.json"))
