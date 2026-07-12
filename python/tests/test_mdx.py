import json

from molplot.mdx import molplot_fence, molplot_validator, render_element


def _extract_spec(el: str) -> dict:
    start = el.index(">", el.index("<script")) + 1
    end = el.index("</script>")
    return json.loads(el[start:end])


def test_render_element_wraps_yaml_spec_in_a_block_div():
    el = render_element(
        "mark: line\n"
        "data:\n"
        "  values:\n"
        "    - {x: 0, y: 1}\n"
        "    - {x: 1, y: 2}\n"
        "encoding:\n"
        "  x: {field: x, type: quantitative}\n"
    )
    # A block-level <div> wrapper keeps Markdown/md_in_html from wrapping the
    # element in <p> or reprocessing the JSON.
    assert el.startswith('<div class="molplot">')
    assert el.endswith("</div>")
    assert "<molplot-chart>" in el
    spec = _extract_spec(el)
    assert spec["mark"] == "line"
    assert spec["data"]["values"] == [{"x": 0, "y": 1}, {"x": 1, "y": 2}]


def test_render_element_accepts_json_spec():
    spec = _extract_spec(render_element('{"mark": "bar", "data": {"values": []}}'))
    assert spec == {"mark": "bar", "data": {"values": []}}


def test_render_element_forwards_preset_and_theme():
    el = render_element("mark: point", preset="molplot-paper", theme="dark")
    assert 'preset="molplot-paper"' in el
    assert 'theme="dark"' in el


def test_render_element_reports_parse_error_inline():
    el = render_element("mark: [unterminated")
    assert "molplot-error" in el
    assert "<molplot-chart" not in el


def test_molplot_fence_reads_options():
    el = molplot_fence(
        "mark: line",
        "molplot",
        "molplot",
        {"preset": "molplot", "theme": "auto"},
        md=None,
    )
    assert 'preset="molplot"' in el
    assert 'theme="auto"' in el
    assert _extract_spec(el) == {"mark": "line"}


def test_validator_accepts_known_options_and_forwards_them():
    options: dict = {}
    ok = molplot_validator(
        "molplot", {"preset": "molplot-paper", "theme": "dark"}, options, {}, None
    )
    assert ok is True
    assert options == {"preset": "molplot-paper", "theme": "dark"}


def test_validator_rejects_unknown_options():
    options: dict = {}
    ok = molplot_validator("molplot", {"bogus": "1"}, options, {}, None)
    assert ok is False
