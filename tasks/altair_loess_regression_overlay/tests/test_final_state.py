import json
import os
import re

import pandas as pd
import pytest

PROJECT_DIR = "/home/user/altair_chart"
OUTPUT_HTML = os.path.join(PROJECT_DIR, "output", "chart.html")
LOG_FILE = os.path.join(PROJECT_DIR, "run.log")
DATA_CSV = os.path.join(PROJECT_DIR, "data", "marketing.csv")
REGIONS = ["North", "South", "West"]


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _read_html():
    assert os.path.isfile(OUTPUT_HTML), f"Output artifact {OUTPUT_HTML} does not exist."
    with open(OUTPUT_HTML, encoding="utf-8") as f:
        return f.read()


def _extract_spec(html):
    """Extract the top-level Vega-Lite spec (JSON) embedded in the HTML."""
    m = re.search(r"spec\s*=\s*\{", html)
    assert m is not None, "Could not find the embedded 'spec = {...}' assignment in the HTML output."
    start = m.end() - 1  # index of the opening '{'
    depth = 0
    in_str = False
    esc = False
    i = start
    while i < len(html):
        c = html[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
        else:
            if c == '"':
                in_str = True
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return json.loads(html[start : i + 1])
        i += 1
    raise AssertionError("Failed to extract a balanced JSON spec from the HTML output.")


def _collect_units(node, out):
    if isinstance(node, dict):
        if "mark" in node:
            out.append(node)
        for v in node.values():
            _collect_units(v, out)
    elif isinstance(node, list):
        for v in node:
            _collect_units(v, out)


def _mark_type_and_def(unit):
    m = unit.get("mark")
    if isinstance(m, str):
        return m, {}
    if isinstance(m, dict):
        return m.get("type"), m
    return None, {}


def _transforms(unit):
    t = unit.get("transform")
    return t if isinstance(t, list) else []


def _has_key(node, key):
    if isinstance(node, dict):
        if key in node:
            return True
        return any(_has_key(v, key) for v in node.values())
    if isinstance(node, list):
        return any(_has_key(v, key) for v in node)
    return False


def _find_data_values(node):
    if isinstance(node, dict):
        if "data" in node and isinstance(node["data"], dict) and "values" in node["data"]:
            return True
        return any(_find_data_values(v) for v in node.values())
    if isinstance(node, list):
        return any(_find_data_values(v) for v in node)
    return False


def _groupby_has_region(transform):
    gb = transform.get("groupby")
    return isinstance(gb, list) and "region" in gb


def _expected_r2():
    """Compute the OLS linear-regression R^2 per region from the bundled CSV."""
    df = pd.read_csv(DATA_CSV)
    out = {}
    for region in REGIONS:
        sub = df[df["region"] == region]
        r = sub["spend"].corr(sub["sales"])  # Pearson r; r**2 == OLS R^2 for linear fit
        out[region] = round(float(r) ** 2, 2)
    return out


# --------------------------------------------------------------------------- #
# Cached, module-level fixtures
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="module")
def spec():
    return _extract_spec(_read_html())


@pytest.fixture(scope="module")
def units(spec):
    out = []
    _collect_units(spec, out)
    return out


@pytest.fixture(scope="module")
def rendered_svg(spec):
    import vl_convert as vlc

    svg = vlc.vegalite_to_svg(vl_spec=json.dumps(spec))
    assert isinstance(svg, str) and len(svg) > 0, "Offline SVG rendering produced no output."
    return svg


# --------------------------------------------------------------------------- #
# Step 1: artifacts exist
# --------------------------------------------------------------------------- #
def test_output_html_exists():
    assert os.path.isfile(OUTPUT_HTML), f"Output artifact {OUTPUT_HTML} does not exist."


def test_log_file_records_save():
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} does not exist."
    with open(LOG_FILE, encoding="utf-8") as f:
        content = f.read()
    expected = f"Chart saved: {OUTPUT_HTML}"
    assert expected in content, (
        f"Log file {LOG_FILE} must contain the line '{expected}', but got:\n{content}"
    )


# --------------------------------------------------------------------------- #
# Step 2: layered spec, inline data, no url
# --------------------------------------------------------------------------- #
def test_spec_is_layered(spec):
    assert _has_key(spec, "layer"), "The Vega-Lite spec must be a layered spec (a 'layer' array)."


def test_spec_has_no_url(spec):
    assert not _has_key(spec, "url"), (
        "The spec must not reference any 'url'; the dataset must be embedded inline."
    )


def test_spec_data_is_inline(spec):
    inline = ("datasets" in spec and spec.get("datasets")) or _find_data_values(spec)
    assert inline, "The spec must embed the dataset inline (via 'datasets' or inline 'values')."


# --------------------------------------------------------------------------- #
# Step 3: required layers/transforms present
# --------------------------------------------------------------------------- #
def test_has_scatter_points(units):
    types = [_mark_type_and_def(u)[0] for u in units]
    assert any(t in ("point", "circle") for t in types), (
        f"Expected a 'point' or 'circle' mark for the raw data, found mark types: {types}"
    )


def test_has_loess_line_grouped_by_region(units):
    for u in units:
        mtype, _ = _mark_type_and_def(u)
        for t in _transforms(u):
            if "loess" in t:
                assert mtype == "line", "The LOESS layer must use a 'line' mark."
                assert _groupby_has_region(t), "The LOESS transform must group by 'region'."
                return
    pytest.fail("No layer with a 'loess' transform was found.")


def test_has_dashed_regression_line_grouped_by_region(units):
    for u in units:
        mtype, mdef = _mark_type_and_def(u)
        for t in _transforms(u):
            if "regression" in t and not t.get("params", False):
                assert mtype == "line", "The regression trend layer must use a 'line' mark."
                assert "strokeDash" in mdef, (
                    "The regression trend line must be dashed (a 'strokeDash' on the line mark)."
                )
                assert _groupby_has_region(t), (
                    "The regression transform must group by 'region'."
                )
                return
    pytest.fail("No dashed regression trend line layer was found.")


def test_has_text_annotation_from_regression_params(units):
    for u in units:
        mtype, _ = _mark_type_and_def(u)
        for t in _transforms(u):
            if "regression" in t and t.get("params", False) is True:
                assert mtype == "text", (
                    "The R\u00b2 annotation layer (regression with params=true) must use a 'text' mark."
                )
                return
    pytest.fail("No text-annotation layer backed by a regression transform with params=true was found.")


# --------------------------------------------------------------------------- #
# Steps 4 & 5: offline render + independent R^2 values
# --------------------------------------------------------------------------- #
def test_rendered_r2_labels_match_expected(rendered_svg):
    expected = _expected_r2()
    # Match only visible <text> content (Vega also embeds the label in an
    # `aria-label` attribute, which would otherwise double-count each label).
    matches = re.findall(r">\s*R\u00b2\s*=\s*(\d+\.\d+)\s*<", rendered_svg)
    assert len(matches) == 3, (
        f"Expected exactly 3 'R\u00b2 = <value>' labels (one per region), found {len(matches)}: {matches}"
    )
    found = [float(m) for m in matches]
    for region, exp in expected.items():
        assert any(abs(exp - f) <= 0.01 for f in found), (
            f"Expected an 'R\u00b2 = {exp:.2f}' label for region {region}, "
            f"but rendered R\u00b2 values were {found}."
        )


# --------------------------------------------------------------------------- #
# Step 6: distinct solid + dashed trend paths rendered
# --------------------------------------------------------------------------- #
def test_rendered_has_dashed_and_solid_paths(rendered_svg):
    assert "stroke-dasharray" in rendered_svg, (
        "The rendered SVG must contain a dashed (regression) trend line ('stroke-dasharray')."
    )
    assert rendered_svg.count("<path") >= 2, (
        "The rendered SVG must contain multiple path elements (scatter points and trend lines)."
    )
