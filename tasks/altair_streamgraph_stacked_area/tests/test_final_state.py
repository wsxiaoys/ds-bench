import json
import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/project"
INPUT_CSV = os.path.join(PROJECT_DIR, "data", "category_volume.csv")
OUTPUT_HTML = os.path.join(PROJECT_DIR, "streamgraph.html")


def _extract_balanced_object(text, start):
    """Return the balanced {...} substring starting at index `start`."""
    depth = 0
    in_str = False
    esc = False
    quote = ""
    for i in range(start, len(text)):
        c = text[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == quote:
                in_str = False
        else:
            if c in ('"', "'"):
                in_str = True
                quote = c
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return text[start : i + 1]
    return None


def _extract_vega_spec(html_text):
    """Find and parse the embedded Vega-Lite spec (the JSON object with an
    `encoding` key) from an Altair-generated standalone HTML document."""
    for match in re.finditer(r"\{", html_text):
        candidate = _extract_balanced_object(html_text, match.start())
        if candidate is None:
            continue
        try:
            obj = json.loads(candidate)
        except (json.JSONDecodeError, ValueError):
            continue
        if isinstance(obj, dict) and "encoding" in obj:
            return obj
    return None


@pytest.fixture(scope="module")
def html_text():
    if os.path.exists(OUTPUT_HTML):
        os.remove(OUTPUT_HTML)
    result = subprocess.run(
        ["python3", "build_streamgraph.py"],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, (
        f"'python3 build_streamgraph.py' failed (exit {result.returncode}).\n"
        f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )
    assert os.path.isfile(OUTPUT_HTML), (
        f"Expected output artifact {OUTPUT_HTML} was not created by the build command."
    )
    with open(OUTPUT_HTML, encoding="utf-8") as f:
        text = f.read()
    assert text.strip(), f"Output artifact {OUTPUT_HTML} is empty."
    return text


@pytest.fixture(scope="module")
def spec(html_text):
    parsed = _extract_vega_spec(html_text)
    assert parsed is not None, (
        "Could not locate an embedded Vega-Lite spec (a JSON object with an "
        "'encoding' key) inside the generated HTML."
    )
    return parsed


def _mark_type(spec):
    mark = spec.get("mark")
    if isinstance(mark, str):
        return mark
    if isinstance(mark, dict):
        return mark.get("type")
    return None


def test_input_untouched():
    assert os.path.isfile(INPUT_CSV), f"Input dataset {INPUT_CSV} is missing."
    with open(INPUT_CSV, encoding="utf-8") as f:
        header = f.readline().strip()
    assert header == "date,category,volume", (
        f"Input dataset header changed; expected 'date,category,volume', got '{header}'."
    )


def test_html_is_vega_embed_document(html_text):
    assert "vegaEmbed(" in html_text, (
        "Generated HTML does not contain a 'vegaEmbed(' call; it is not a real "
        "Vega-Embed document produced by Altair's HTML export."
    )


def test_streamgraph_mark(spec):
    assert _mark_type(spec) == "area", (
        f"Expected mark type 'area' for a streamgraph, got {_mark_type(spec)!r}."
    )


def test_temporal_x_with_monthly_rollup(spec):
    x = spec.get("encoding", {}).get("x", {})
    assert x.get("field") == "date", f"x encoding field should be 'date', got {x.get('field')!r}."
    assert x.get("timeUnit") == "yearmonth", (
        f"x encoding timeUnit should be 'yearmonth', got {x.get('timeUnit')!r}."
    )
    assert x.get("type") == "temporal", f"x encoding type should be 'temporal', got {x.get('type')!r}."
    axis = x.get("axis")
    assert isinstance(axis, dict) and axis.get("format") == "%Y", (
        f"x axis format should be '%Y', got {axis!r}."
    )


def test_centered_stacked_sum_y_with_hidden_axis(spec):
    y = spec.get("encoding", {}).get("y", {})
    assert y.get("aggregate") == "sum", f"y encoding aggregate should be 'sum', got {y.get('aggregate')!r}."
    assert y.get("field") == "volume", f"y encoding field should be 'volume', got {y.get('field')!r}."
    assert y.get("type") == "quantitative", (
        f"y encoding type should be 'quantitative', got {y.get('type')!r}."
    )
    assert y.get("stack") == "center", (
        f"y encoding stack should be 'center' (streamgraph), got {y.get('stack')!r}."
    )
    assert "axis" in y and y.get("axis") is None, (
        f"y axis should be hidden (null), got {y.get('axis')!r}."
    )


def test_category_color_with_scheme(spec):
    color = spec.get("encoding", {}).get("color", {})
    assert color.get("field") == "category", (
        f"color encoding field should be 'category', got {color.get('field')!r}."
    )
    assert color.get("type") == "nominal", (
        f"color encoding type should be 'nominal', got {color.get('type')!r}."
    )
    scale = color.get("scale", {})
    assert isinstance(scale, dict) and scale.get("scheme") == "tableau20", (
        f"color scale scheme should be 'tableau20', got {scale.get('scheme')!r}."
    )


def test_tooltip_encoding(spec):
    tooltip = spec.get("encoding", {}).get("tooltip")
    assert isinstance(tooltip, list) and len(tooltip) >= 3, (
        f"tooltip encoding should be a list with at least 3 fields, got {tooltip!r}."
    )
    has_category = any(t.get("field") == "category" for t in tooltip if isinstance(t, dict))
    has_month = any(
        t.get("field") == "date" and t.get("timeUnit") == "yearmonth"
        for t in tooltip
        if isinstance(t, dict)
    )
    has_volume = any(
        t.get("field") == "volume" and t.get("aggregate") == "sum"
        for t in tooltip
        if isinstance(t, dict)
    )
    assert has_category, f"tooltip should include the 'category' field; got {tooltip!r}."
    assert has_month, (
        f"tooltip should include the 'yearmonth' of 'date'; got {tooltip!r}."
    )
    assert has_volume, (
        f"tooltip should include the summed 'volume' (aggregate 'sum'); got {tooltip!r}."
    )


def test_interactive_scales_param(spec):
    params = spec.get("params", [])
    assert isinstance(params, list) and any(
        isinstance(p, dict) and p.get("bind") == "scales" for p in params
    ), (
        "Expected an interactive parameter with bind == 'scales' (from .interactive()); "
        f"got params {params!r}."
    )


def test_axis_theme_config(spec):
    axis_cfg = spec.get("config", {}).get("axis", {})
    assert axis_cfg.get("grid") is False, (
        f"config.axis.grid should be false, got {axis_cfg.get('grid')!r}."
    )
    assert axis_cfg.get("labelFontSize") == 12, (
        f"config.axis.labelFontSize should be 12, got {axis_cfg.get('labelFontSize')!r}."
    )
    assert axis_cfg.get("titleFontSize") == 14, (
        f"config.axis.titleFontSize should be 14, got {axis_cfg.get('titleFontSize')!r}."
    )


def test_view_theme_config(spec):
    view_cfg = spec.get("config", {}).get("view", {})
    assert "stroke" in view_cfg and view_cfg.get("stroke") is None, (
        f"config.view.stroke should be null (border removed), got {view_cfg.get('stroke')!r}."
    )
