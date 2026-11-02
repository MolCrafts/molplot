"""FastAPI workbench: /api/result, /api/commands, /api/export."""

from __future__ import annotations

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from fastapi.testclient import TestClient
from molplot.cli import main
from molplot.engines.matplotlib import MatplotlibEngine
from molplot.host.figures import kinetics_figure, load_script
from molplot.host.server import Session, create_app, page_index


def teardown_function():
    plt.close("all")


def _client():
    session = Session(kinetics_figure(), script="/tmp/kinetics.py")
    return TestClient(create_app(session))


def _legend(root):
    if root["role"] == "legend":
        return root
    for child in root.get("children") or []:
        hit = _legend(child)
        if hit:
            return hit
    return None


def test_workbench_and_result():
    client = _client()
    html = client.get("/").text
    assert "MolPlot workbench" in html
    assert "MolPlot workbench" in page_index().read_text()
    result = client.get("/api/result").json()
    assert result["scene"]["engineId"] == "matplotlib"
    assert result["script"].endswith("kinetics.py")
    assert "<svg" in result["view"]["svg"].lower()
    assert result["datasets"]
    assert result["paths"]


def test_export_formats_are_frontend_chosen():
    client = _client()
    pdf = client.get("/api/export/pdf")
    assert pdf.status_code == 200
    assert pdf.content[:4] == b"%PDF"
    assert "inline" in pdf.headers["content-disposition"]
    svg = client.get("/api/export/svg")
    assert svg.status_code == 200
    assert b"<svg" in svg.content.lower()
    png = client.get("/api/export/png")
    assert png.status_code == 200
    assert png.content[:8] == b"\x89PNG\r\n\x1a\n"
    attached = client.get("/api/export/pdf", params={"download": True})
    assert "attachment" in attached.headers["content-disposition"]
    assert "kinetics.pdf" in attached.headers["content-disposition"]
    missing = client.get("/api/export/gif")
    assert missing.status_code == 404


def test_command_moves_legend_and_export_changes():
    client = _client()
    result = client.get("/api/result").json()
    legend = _legend(result["scene"]["root"])
    assert legend is not None
    box = legend["components"]["geometry"]["bbox"]
    before = client.get("/api/export/pdf").content
    applied = client.post(
        "/api/commands",
        json={
            "requestId": "host-move",
            "command": {
                "type": "set",
                "nodeId": legend["id"],
                "component": "geometry",
                "property": "bbox",
                "value": {
                    "x": max(0.05, box["x"] - 0.2),
                    "y": max(0.05, box["y"] - 0.2),
                    "w": box["w"],
                    "h": box["h"],
                },
                "baseRevision": result["revision"],
            },
        },
    ).json()
    assert applied["ok"], applied
    after = client.get("/api/export/pdf").content
    assert after != before


def test_stale_command():
    client = _client()
    result = client.get("/api/result").json()
    legend = _legend(result["scene"]["root"])
    box = legend["components"]["geometry"]["bbox"]
    applied = client.post(
        "/api/commands",
        json={
            "requestId": "stale",
            "command": {
                "type": "set",
                "nodeId": legend["id"],
                "component": "geometry",
                "property": "bbox",
                "value": box,
                "baseRevision": 0,
            },
        },
    ).json()
    assert applied["ok"] is False
    assert applied["error"]["code"] == "stale_revision"


def test_unknown_path_404():
    client = _client()
    assert client.get("/nope").status_code == 404


def test_cli_requires_subcommand():
    try:
        main([])
        raise AssertionError("expected SystemExit")
    except SystemExit as exc:
        assert exc.code != 0


def test_cli_serve_requires_script():
    try:
        main(["serve"])
        raise AssertionError("expected SystemExit")
    except SystemExit as exc:
        assert exc.code != 0


def test_result_reports_figure_count():
    client = _client()
    result = client.get("/api/result").json()
    assert result["figureCount"] == 1


def test_multi_figure_session_payload():
    fig1, ax1 = plt.subplots()
    ax1.plot([0, 1], [0, 1])
    fig2, ax2 = plt.subplots()
    ax2.plot([0, 1], [1, 0])
    session = Session([fig1, fig2], script="/tmp/multi.py")
    client = TestClient(create_app(session))
    result = client.get("/api/result").json()
    assert result["figureCount"] == 2
    assert result["scene"]["root"]["id"] == "session"


def test_savefig_hook_is_restored_after_load(tmp_path):
    from matplotlib.figure import Figure

    original = Figure.savefig
    script = tmp_path / "plain.py"
    script.write_text(
        "import matplotlib.pyplot as plt\nfig, ax = plt.subplots()\nax.plot([0, 1], [0, 1])\n"
    )
    load_script(str(script))
    assert Figure.savefig is original


def test_load_script_ignores_savefig(tmp_path):
    out = tmp_path / "should_not_exist.pdf"
    script = tmp_path / "fig.py"
    script.write_text(
        "import matplotlib.pyplot as plt\n"
        "fig, ax = plt.subplots()\n"
        "ax.plot([0, 1], [0, 1])\n"
        f"fig.savefig({str(out)!r})\n"
        "plt.savefig({!r})\n".format(str(tmp_path / "also.pdf"))
    )
    figs = load_script(str(script))
    assert len(figs) == 1
    assert not out.exists()
    assert not (tmp_path / "also.pdf").exists()


def test_load_script_collects_figs_list(tmp_path):
    script = tmp_path / "figs.py"
    script.write_text(
        "import matplotlib.pyplot as plt\n"
        "f1, ax1 = plt.subplots()\n"
        "ax1.plot([0, 1], [0, 1])\n"
        "f2, ax2 = plt.subplots()\n"
        "ax2.plot([0, 1], [1, 0])\n"
        "figs = [f1, f2]\n"
    )
    figs = load_script(str(script))
    assert len(figs) == 2
    engine = MatplotlibEngine(figs)
    scene = engine.reflect()
    assert scene.root.id == "session"
    assert [node.id for node in scene.root.children] == ["figure/0", "figure/1"]


def test_load_script_reload_keeps_node_ids(tmp_path):
    script = tmp_path / "a.py"
    script.write_text(
        "import matplotlib.pyplot as plt\n"
        "fig, ax = plt.subplots()\n"
        "ax.plot([0, 1], [0, 1], label='A')\n"
        "ax.set_title('Hello')\n"
        "ax.legend()\n"
    )
    first = MatplotlibEngine(load_script(str(script))).reflect()
    second = MatplotlibEngine(load_script(str(script))).reflect()

    def ids(node):
        out = [node.id]
        for child in node.children:
            out.extend(ids(child))
        return out

    assert ids(first.root) == ids(second.root)
    assert "figure/0/panel/0/series/0" in ids(first.root)


def test_load_script_does_not_pick_up_leftover_figures(tmp_path):
    leftover, ax = plt.subplots()
    ax.plot([9, 8], [7, 6])
    script = tmp_path / "one.py"
    script.write_text(
        "import matplotlib.pyplot as plt\n"
        "fig, ax = plt.subplots()\n"
        "ax.plot([0, 1], [0, 1])\n"
    )
    figs = load_script(str(script))
    assert len(figs) == 1
    assert figs[0] is not leftover
