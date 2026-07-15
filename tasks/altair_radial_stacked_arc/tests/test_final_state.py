import json
import os

import pytest

PROJECT_DIR = "/home/user/project"
HTML_PATH = os.path.join(PROJECT_DIR, "radial.html")

EXPECTED_DATA = {
    "Organic Search": 3120,
    "Direct": 1980,
    "Referral": 1520,
    "Social": 1360,
    "Email": 880,
    "Paid Ads": 640,
}
EXPECTED_TOTAL = 9500


def _read_html():
    assert os.path.isfile(HTML_PATH), f"Expected output file not found: {HTML_PATH}"
    with open(HTML_PATH, "r", encoding="utf-8") as f:
        return f.read()


def _extract_spec(html):
    """Extract the embedded Vega-Lite spec JSON from the `var spec = {...};` assignment."""
    marker = "var spec ="
    idx = html.find(marker)
    assert idx != -1, "Could not find `var spec =` assignment in the HTML (not a standalone Altair page)."
    start = html.find("{", idx)
    assert start != -1, "Could not find start of spec JSON object in the HTML."
    # Balanced-brace scan that ignores braces inside JSON strings.
    depth = 0
    in_str = False
    escape = False
    end = None
    for i in range(start, len(html)):
        ch = html[i]
        if in_str:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    assert end is not None, "Could not locate the end of the spec JSON object in the HTML."
    return json.loads(html[start:end])


def _collect_inline_rows(spec):
    """Collect all inline data rows from `datasets` and any inline `data.values`."""
    rows = []
    datasets = spec.get("datasets")
    if isinstance(datasets, dict):
        for value in datasets.values():
            if isinstance(value, list):
                rows.extend(value)

    def walk(node):
        if isinstance(node, dict):
            if "values" in node and isinstance(node["values"], list):
                rows.extend(node["values"])
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(spec)
    return rows


def _find_mark_type(view):
    mark = view.get("mark")
    if isinstance(mark, str):
        return mark
    if isinstance(mark, dict):
        return mark.get("type")
    return None


@pytest.fixture(scope="module")
def spec():
    html = _read_html()
    assert "vegaEmbed(" in html, "The HTML does not contain a `vegaEmbed(` call; not a standalone Altair page."
    return _extract_spec(html)


def test_html_file_exists_and_is_standalone():
    html = _read_html()
    assert "vegaEmbed(" in html, "The HTML does not contain a `vegaEmbed(` call."
    assert "var spec =" in html, "The HTML does not embed a `var spec =` assignment."


def test_no_remote_data_source(spec):
    serialized = json.dumps(spec)
    assert '"url"' not in serialized, (
        "The spec references a remote data `url`; the chart must use only local/inline data."
    )


def test_inline_data_matches_expected(spec):
    rows = _collect_inline_rows(spec)
    assert rows, "No inline data rows found in the spec (datasets/data.values missing)."
    # Keep only rows shaped like the expected records.
    records = {
        r.get("source"): r.get("visits")
        for r in rows
        if isinstance(r, dict) and "source" in r and "visits" in r
    }
    assert records, "No rows with fields `source` and `visits` were found in the inline data."
    for name, value in EXPECTED_DATA.items():
        assert name in records, f"Expected traffic source '{name}' missing from inline data."
        assert records[name] == value, (
            f"Traffic source '{name}' should have visits={value}, got {records[name]}."
        )
    assert sum(v for v in records.values() if isinstance(v, (int, float))) == EXPECTED_TOTAL, (
        f"Total visits across sources should equal {EXPECTED_TOTAL}."
    )


def test_top_level_hconcat_of_two_views(spec):
    assert "hconcat" in spec, "Top-level spec must be a horizontal concatenation (`hconcat`)."
    assert isinstance(spec["hconcat"], list) and len(spec["hconcat"]) == 2, (
        f"`hconcat` must contain exactly 2 views, got {len(spec.get('hconcat', []))}."
    )


def test_left_view_layered_radial_arc_with_label_ring(spec):
    left = spec["hconcat"][0]
    assert "layer" in left and isinstance(left["layer"], list) and len(left["layer"]) == 2, (
        "The left view must be a layered chart with exactly 2 layers (arc + text label ring)."
    )
    layers = left["layer"]
    arc_layer = next((l for l in layers if _find_mark_type(l) == "arc"), None)
    text_layer = next((l for l in layers if _find_mark_type(l) == "text"), None)
    assert arc_layer is not None, "The left view must contain an `arc` mark layer."
    assert text_layer is not None, "The left view must contain a `text` mark layer (the label ring)."

    # Arc mark should be a donut (non-zero innerRadius).
    arc_mark = arc_layer["mark"]
    assert isinstance(arc_mark, dict), "The arc layer mark must be an object with `innerRadius`."
    inner_radius = arc_mark.get("innerRadius")
    assert isinstance(inner_radius, (int, float)) and inner_radius > 0, (
        "The arc mark must have a non-zero `innerRadius` (a donut)."
    )

    arc_enc = arc_layer.get("encoding", {})

    theta = arc_enc.get("theta", {})
    assert theta.get("field") == "visits", "The arc `theta` channel must encode the `visits` field."
    assert theta.get("type") == "quantitative", "The arc `theta` channel must be quantitative."
    assert theta.get("stack") is True, (
        "The arc `theta` channel must use additive stacking (stack == true)."
    )

    radius = arc_enc.get("radius", {})
    assert radius.get("field") == "visits", "The arc `radius` channel must encode the `visits` field."
    scale = radius.get("scale", {})
    assert scale.get("type") == "sqrt", "The arc `radius` scale type must be `sqrt`."

    color = arc_enc.get("color", {})
    assert color.get("field") == "source", "The arc `color` channel must encode the `source` field."
    assert color.get("scale", {}).get("scheme") == "tableau20", (
        "The `color` scale must use the `tableau20` scheme."
    )
    legend = color.get("legend")
    assert isinstance(legend, dict) and legend.get("title") == "Traffic Source", (
        "The color legend must be present with title 'Traffic Source'."
    )

    text_enc = text_layer.get("encoding", {})
    assert text_enc.get("text", {}).get("field") == "source", (
        "The text label ring must encode the `source` field on the `text` channel."
    )


def test_right_view_normalized_radial_arc(spec):
    right = spec["hconcat"][1]
    assert _find_mark_type(right) == "arc", "The right view must use an `arc` mark."
    enc = right.get("encoding", {})
    theta = enc.get("theta", {})
    assert theta.get("field") == "visits", "The right view `theta` channel must encode the `visits` field."
    assert theta.get("stack") == "normalize", (
        "The right view `theta` channel must use normalized stacking (stack == 'normalize')."
    )
    color = enc.get("color", {})
    assert color.get("field") == "source", "The right view `color` channel must encode the `source` field."
    assert color.get("scale", {}).get("scheme") == "tableau20", (
        "The right view `color` scale must use the `tableau20` scheme."
    )
