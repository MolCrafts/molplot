import matplotlib.pyplot as plt

import molplot


def test_available_lists_presets():
    assert set(molplot.available()) >= {"molplot", "molplot-paper"}


def test_register_adds_mplstyle_to_library():
    import matplotlib.style as mstyle

    molplot.register()
    assert "molplot" in mstyle.library


def test_style_context_applies_and_restores():
    before = plt.rcParams["axes.prop_cycle"].by_key()["color"]
    with molplot.style("molplot"):
        inside = plt.rcParams["axes.prop_cycle"].by_key()["color"]
        assert inside[0] == "#0c5da5"
    after = plt.rcParams["axes.prop_cycle"].by_key()["color"]
    assert after == before


def test_use_applies_persistently():
    molplot.use("molplot")
    assert plt.rcParams["axes.prop_cycle"].by_key()["color"][0] == "#0c5da5"
    assert plt.rcParams["font.size"] == 10


def test_science_base_present_when_scienceplots_installed():
    # scienceplots is a hard dependency, so the base must resolve non-empty.
    assert molplot.science_base("molplot") == ["science", "no-latex"]
