"""Workbench style catalog and matplotlib rc overlay (host-only)."""

from __future__ import annotations

import matplotlib as mpl
import matplotlib.pyplot as plt
import pytest
from fastapi.testclient import TestClient
from molplot.host.figures import load_script
from molplot.host.server import Session, create_app
from molplot.host.style import (
    INSTALL_HINTS,
    LATEX_HINT,
    StyleError,
    apply_source,
    catalog,
    payload,
    read_rc,
)


def teardown_function():
    plt.close("all")
    mpl.rc_file_defaults()


def _script(tmp_path, extra: str = "") -> str:
    path = tmp_path / "fig.py"
    path.write_text(
        "import matplotlib.pyplot as plt\n"
        "fig, ax = plt.subplots()\n"
        "ax.plot([0, 1], [0, 1], label='A')\n"
        "ax.set_xlabel('x')\n"
        "ax.set_ylabel('y')\n"
        "ax.set_title('T')\n"
        "ax.legend()\n"
        f"{extra}"
    )
    return str(path)


def _client(tmp_path):
    script = _script(tmp_path)
    session = Session(load_script(script), script=script)
    return TestClient(create_app(session)), session


def test_catalog_lists_sources_and_disables_missing_seaborn():
    data = catalog()
    ids = [item["id"] for item in data["sources"]]
    assert ids == ["script", "molplot", "scienceplots", "seaborn", "custom"]
    seaborn = next(item for item in data["sources"] if item["id"] == "seaborn")
    assert seaborn["available"] is False
    assert seaborn["hint"] == INSTALL_HINTS["seaborn"]
    assert {item["id"] for item in seaborn["styles"]} == {
        "darkgrid",
        "whitegrid",
        "dark",
        "white",
        "ticks",
    }
    molplot = next(item for item in data["sources"] if item["id"] == "molplot")
    assert {item["id"] for item in molplot["styles"]} >= {"molplot", "molplot-paper"}
    assert "fontSize" in data["rc"]
    assert "palette" in data["rc"]
    assert "available" in data["latex"]
    if not data["latex"]["available"]:
        assert data["latex"]["hint"] == LATEX_HINT


def test_catalog_disables_scienceplots_when_missing(monkeypatch):
    monkeypatch.setattr(
        "molplot.host.style.module_available",
        lambda name: name not in {"scienceplots", "seaborn"},
    )
    data = catalog()
    science = next(item for item in data["sources"] if item["id"] == "scienceplots")
    assert science["available"] is False
    assert science["hint"] == INSTALL_HINTS["scienceplots"]
    assert any(item["id"] == "science" for item in science["styles"])


def test_catalog_scienceplots_available_when_installed():
    science = next(
        item for item in catalog()["sources"] if item["id"] == "scienceplots"
    )
    if not science["available"]:
        return
    assert {item["id"] for item in science["styles"]} >= {"science", "nature", "ieee"}


def test_custom_rc_roundtrip():
    mpl.rc_file_defaults()
    apply_source(
        "custom",
        "custom",
        {
            "fontSize": 14,
            "grid": True,
            "lineWidth": 2.5,
            "figureWidth": 5,
            "figureHeight": 3,
            "palette": ["#112233", "#abcdef"],
            "savefigBbox": "tight",
            "tickDirection": "in",
        },
    )
    rc = read_rc()
    assert rc["fontSize"] == 14
    assert rc["grid"] is True
    assert rc["lineWidth"] == pytest.approx(2.5)
    assert rc["figureWidth"] == 5
    assert rc["figureHeight"] == 3
    assert rc["palette"][0] == "#112233"
    assert rc["savefigBbox"] == "tight"
    assert rc["tickDirection"] == "in"
    assert mpl.rcParams["ytick.direction"] == "in"


def test_apply_source_rejects_missing_seaborn():
    import pytest

    with pytest.raises(Exception) as exc:
        apply_source("seaborn", "whitegrid")
    assert getattr(exc.value, "code", None) == "not_editable"
    assert "seaborn" in str(exc.value).lower()


def test_apply_source_rejects_unknown_source():
    import pytest

    with pytest.raises(Exception) as exc:
        apply_source("ggplot", "bmh")
    assert getattr(exc.value, "code", None) == "invalid_value"


def test_result_includes_style_catalog(tmp_path):
    client, _session = _client(tmp_path)
    result = client.get("/api/result").json()
    style = result["style"]
    assert style["current"] == {"source": "script", "name": "script"}
    assert [item["id"] for item in style["sources"]][0] == "script"
    assert style["rc"]["fontSize"] > 0


def test_style_command_applies_molplot_and_reloads(tmp_path):
    client, _session = _client(tmp_path)
    applied = client.post(
        "/api/commands",
        json={
            "requestId": "style-molplot",
            "command": {"type": "style", "source": "molplot", "name": "molplot"},
        },
    ).json()
    assert applied["ok"], applied
    style = applied["result"]["style"]
    assert style["current"] == {"source": "molplot", "name": "molplot"}
    assert plt.rcParams["axes.prop_cycle"].by_key()["color"][0].lower() in {
        "#0c5da5",
        "0c5da5",
    }
    root = applied["result"]["scene"]["root"]
    assert root["role"] in {"figure", "session"}


def test_style_command_custom_rc_changes_figure_size(tmp_path):
    client, _session = _client(tmp_path)
    result = client.get("/api/result").json()
    rc = dict(result["style"]["rc"])
    rc["figureWidth"] = 5.0
    rc["figureHeight"] = 3.0
    rc["fontSize"] = 14
    applied = client.post(
        "/api/commands",
        json={
            "requestId": "style-custom",
            "command": {
                "type": "style",
                "source": "custom",
                "name": "custom",
                "rc": rc,
            },
        },
    ).json()
    assert applied["ok"], applied
    layout = applied["result"]["scene"]["root"]["components"]["layout"]
    assert layout["width"] == pytest.approx(5.0)
    assert layout["height"] == pytest.approx(3.0)
    assert applied["result"]["style"]["rc"]["fontSize"] == 14


def test_style_command_missing_package_keeps_figure(tmp_path):
    client, session = _client(tmp_path)
    before = client.get("/api/result").json()["revision"]
    applied = client.post(
        "/api/commands",
        json={
            "requestId": "style-seaborn",
            "command": {"type": "style", "source": "seaborn", "name": "whitegrid"},
        },
    ).json()
    assert applied["ok"] is False
    assert applied["error"]["code"] == "not_editable"
    assert "pip install seaborn" in applied["error"]["message"]
    assert session.engine.revision() == before


def test_style_command_requires_script():
    fig, ax = plt.subplots()
    ax.plot([0, 1], [0, 1])
    client = TestClient(
        create_app(Session(fig, script="/tmp/missing-molplot-style.py"))
    )
    applied = client.post(
        "/api/commands",
        json={
            "requestId": "no-script",
            "command": {"type": "style", "source": "molplot", "name": "molplot"},
        },
    ).json()
    assert applied["ok"] is False
    assert applied["error"]["code"] == "apply_failed"


def test_set_command_still_works_after_style(tmp_path):
    client, _session = _client(tmp_path)
    styled = client.post(
        "/api/commands",
        json={
            "requestId": "style-then-set",
            "command": {"type": "style", "source": "molplot", "name": "molplot"},
        },
    ).json()
    assert styled["ok"], styled
    result = styled["result"]

    def _legend(node):
        if node["role"] == "legend":
            return node
        for child in node.get("children") or []:
            hit = _legend(child)
            if hit:
                return hit
        return None

    legend = _legend(result["scene"]["root"])
    assert legend is not None
    box = legend["components"]["geometry"]["bbox"]
    moved = client.post(
        "/api/commands",
        json={
            "requestId": "move-after-style",
            "command": {
                "type": "set",
                "nodeId": legend["id"],
                "component": "geometry",
                "property": "bbox",
                "value": {**box, "x": max(0.05, box["x"] - 0.1)},
                "baseRevision": result["revision"],
            },
        },
    ).json()
    assert moved["ok"], moved


def test_apply_scienceplots_when_installed():
    science = next(
        item for item in catalog()["sources"] if item["id"] == "scienceplots"
    )
    if not science["available"]:
        pytest.skip("scienceplots is not installed")
    apply_source("scienceplots", "science")
    assert mpl.rcParams["lines.linewidth"] > 0


def test_scienceplots_science_disables_usetex_when_latex_unusable(monkeypatch):
    science = next(
        item for item in catalog()["sources"] if item["id"] == "scienceplots"
    )
    if not science["available"]:
        pytest.skip("scienceplots is not installed")
    monkeypatch.setattr("molplot.host.style.latex_usable", lambda: False)
    apply_source("scienceplots", "science")
    assert mpl.rcParams["text.usetex"] is False


def test_custom_usetex_rejected_when_latex_unusable(monkeypatch):
    monkeypatch.setattr("molplot.host.style.latex_usable", lambda: False)
    with pytest.raises(StyleError) as exc:
        apply_source("custom", "custom", {"usetex": True})
    assert exc.value.code == "not_editable"
    assert "type1cm" in exc.value.message


def test_style_command_scienceplots_science_renders(tmp_path, monkeypatch):
    science = next(
        item for item in catalog()["sources"] if item["id"] == "scienceplots"
    )
    if not science["available"]:
        pytest.skip("scienceplots is not installed")
    # Keep the assertion host-agnostic: scienceplots enables usetex when
    # LaTeX is present; the workbench must still disable it and render SVG.
    monkeypatch.setattr("molplot.host.style.latex_usable", lambda: False)
    client, _session = _client(tmp_path)
    applied = client.post(
        "/api/commands",
        json={
            "requestId": "style-science",
            "command": {"type": "style", "source": "scienceplots", "name": "science"},
        },
    ).json()
    assert applied["ok"], applied
    assert applied["result"]["style"]["rc"]["usetex"] is False
    assert "<svg" in applied["result"]["view"]["svg"].lower()


def test_payload_current_matches_args():
    data = payload("molplot", "molplot-paper")
    assert data["current"] == {"source": "molplot", "name": "molplot-paper"}
    assert data["rc"]["fontSize"] > 0
