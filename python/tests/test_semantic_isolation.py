from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src/molplot/semantic"

BANNED = (
    "import matplotlib",
    "from matplotlib",
    "Line2D",
    "PathCollection",
    "vega-embed",
    "from vega",
    "import vega",
)


def test_semantic_package_does_not_import_backends():
    files = list(ROOT.rglob("*.py"))
    assert files
    for path in files:
        text = path.read_text(encoding="utf-8")
        for token in BANNED:
            assert token not in text, f"{path} contains {token}"
