import molplot
from molplot.preset import get_preset, rc_params, resolve


def test_presets_available():
    assert "molplot" in molplot.PRESET_NAMES
    assert "molplot-paper" in molplot.PRESET_NAMES


def test_unknown_preset_falls_back():
    assert get_preset("nope")["name"] == "molplot"


def test_palette_matches_tokens():
    assert molplot.palette("molplot")[0] == "#0c5da5"
    assert molplot.palette() == get_preset("molplot")["palette"]["categorical"]


def test_resolve_light_vs_dark():
    light = resolve("molplot", "light")
    dark = resolve("molplot", "dark")
    assert light["foreground"] != dark["foreground"]
    assert light["mode"] == "light"


def test_rc_params_inject_palette_and_type_scale():
    rc = rc_params("molplot", "light")
    colors = rc["axes.prop_cycle"].by_key()["color"]
    assert colors[0] == "#0c5da5"
    assert rc["font.size"] == 10
    assert rc["axes.grid"] is True


def test_paper_preset_is_serif_high_dpi():
    rc = rc_params("molplot-paper", "light")
    assert rc["font.family"] == "serif"
    assert rc["figure.dpi"] == 600
