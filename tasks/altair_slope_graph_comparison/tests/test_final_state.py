import json
import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/project"
BUILD_SCRIPT = os.path.join(PROJECT_DIR, "build_slope_graph.py")
OUTPUT_HTML = os.path.join(PROJECT_DIR, "slope_graph.html")

# Endpoint (2024) revenue values that are unlikely to coincide with y-axis ticks,
# used to confirm the text-mark labels actually render.
ENDPOINT_LABEL_VALUES = ["168", "145", "88", "104"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _extract_vega_spec(html):
    """Extract the embedded Vega-Lite spec object from an Altair-saved HTML page.

    Altair's HTML export embeds the spec as `var spec = { ... };`. We locate the
    assignment and brace-match the JSON object while respecting string literals.
    """
    m = re.search(r"\bspec\s*=\s*\{", html)
    assert m is not None, "Could not find the embedded `spec = {` assignment in the HTML."
    start = m.end() - 1
    depth = 0
    in_str = False
    esc = False
    quote = ""
    for i in range(start, len(html)):
        c = html[i]
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
                    return json.loads(html[start : i + 1])
    raise AssertionError("Failed to brace-match the embedded Vega-Lite spec object.")


def _walk(obj):
    """Yield every dict nested anywhere inside the spec."""
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from _walk(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk(v)


def _collect_mark_types(spec):
    marks = set()
    for d in _walk(spec):
        mark = d.get("mark")
        if isinstance(mark, str):
            marks.add(mark)
        elif isinstance(mark, dict) and isinstance(mark.get("type"), str):
            marks.add(mark["type"])
    return marks


def _collect_calculate_as_fields(spec):
    fields = set()
    for d in _walk(spec):
        transforms = d.get("transform")
        if isinstance(transforms, list):
            for t in transforms:
                if isinstance(t, dict) and "calculate" in t and t.get("as"):
                    fields.add(t["as"])
    return fields


def _collect_color_fields(spec):
    fields = set()
    for d in _walk(spec):
        enc = d.get("encoding")
        if isinstance(enc, dict):
            color = enc.get("color")
            if isinstance(color, dict) and color.get("field"):
                fields.add(color["field"])
    return fields


def _collect_remote_data_urls(spec):
    urls = []
    for d in _walk(spec):
        url = d.get("url")
        if isinstance(url, str) and url.startswith(("http://", "https://")):
            urls.append(url)
    return urls


def _collect_inline_values(spec):
    """Collect embedded row data from either inline `values` arrays or named
    `datasets` (Altair commonly embeds a DataFrame under a `datasets` entry and
    references it via `data: {"name": ...}`)."""
    values = []
    for d in _walk(spec):
        v = d.get("values")
        if isinstance(v, list):
            values.extend(v)
        datasets = d.get("datasets")
        if isinstance(datasets, dict):
            for rows in datasets.values():
                if isinstance(rows, list):
                    values.extend(rows)
    return values


def _line_paths(svg):
    """Return list of (d, stroke) for SVG path elements that are line marks.

    Vega/vl-convert tags line-mark paths with `aria-roledescription="line mark"`
    and encodes the color via a `stroke` attribute (or, in some renderers, an
    inline `style`)."""
    result = []
    for tag in re.findall(r"<path\b[^>]*>", svg):
        is_line = 'aria-roledescription="line mark"' in tag
        if not is_line:
            style_m = re.search(r'style="([^"]*)"', tag)
            style = style_m.group(1) if style_m else ""
            if "fill:none" not in style.replace(" ", ""):
                continue
        d_m = re.search(r'\bd="([^"]*)"', tag)
        if d_m is None:
            continue
        stroke_m = re.search(r'\bstroke="([^"]+)"', tag)
        if stroke_m is None:
            style_m = re.search(r'style="([^"]*)"', tag)
            style = style_m.group(1) if style_m else ""
            s2 = re.search(r"stroke:\s*([^;]+)", style)
            stroke = s2.group(1).strip() if s2 else ""
        else:
            stroke = stroke_m.group(1).strip()
        result.append((d_m.group(1), stroke))
    return result


def _svg_text_content(svg):
    return " ".join(re.findall(r"<text[^>]*>(.*?)</text>", svg, re.S))


# ---------------------------------------------------------------------------
# Fixtures (regenerate the artifact per the truth Setup section)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def html_content():
    if os.path.exists(OUTPUT_HTML):
        os.remove(OUTPUT_HTML)
    assert os.path.isfile(BUILD_SCRIPT), (
        f"Expected the executor's build script at {BUILD_SCRIPT}."
    )
    proc = subprocess.run(
        ["python3", BUILD_SCRIPT],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=300,
    )
    assert proc.returncode == 0, (
        f"Running the build script failed (exit {proc.returncode}).\n"
        f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
    )
    assert os.path.isfile(OUTPUT_HTML), (
        f"The build script did not produce the HTML artifact at {OUTPUT_HTML}."
    )
    with open(OUTPUT_HTML, encoding="utf-8") as f:
        return f.read()


@pytest.fixture(scope="session")
def spec(html_content):
    return _extract_vega_spec(html_content)


@pytest.fixture(scope="session")
def svg(spec):
    import vl_convert as vlc

    return vlc.vegalite_to_svg(json.dumps(spec))


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
def test_html_is_vega_embed_page(html_content):
    assert "vegaEmbed" in html_content, (
        "The HTML artifact must be a standalone Vega-Embed page (missing `vegaEmbed`)."
    )
    assert re.search(r"\bspec\s*=\s*\{", html_content) is not None, (
        "The HTML artifact must embed a Vega-Lite spec assigned to a `spec` variable."
    )


def test_input_csv_untouched(html_content):
    csv_path = os.path.join(PROJECT_DIR, "data", "regional_revenue.csv")
    with open(csv_path, encoding="utf-8") as f:
        header = f.readline().strip()
    cols = [c.strip() for c in header.split(",")]
    assert cols == ["region", "revenue_2023", "revenue_2024"], (
        "The input CSV must still contain only the columns "
        "region, revenue_2023, revenue_2024 (the trend must be computed in-spec, "
        f"not pre-added to the data). Found: {cols}"
    )


def test_layered_three_marks(spec):
    assert "layer" in spec and isinstance(spec["layer"], list), (
        "The chart must be a layered composition (top-level `layer` array)."
    )
    assert len(spec["layer"]) >= 3, (
        f"Expected at least 3 layers (line, point, text); found {len(spec['layer'])}."
    )
    marks = _collect_mark_types(spec)
    for required in ("line", "point", "text"):
        assert required in marks, (
            f"The layered chart must include a '{required}' mark. Found marks: {sorted(marks)}"
        )


def test_data_is_local_inline(spec):
    remote = _collect_remote_data_urls(spec)
    assert not remote, (
        f"The chart must not reference any remote data URL; found: {remote}"
    )
    values = _collect_inline_values(spec)
    assert values, "The chart data must be embedded inline (`values`) in the spec."
    blob = json.dumps(values)
    for region in ("North", "South", "East", "West", "Central", "Mountain"):
        assert region in blob, (
            f"Inline data must contain the region '{region}'. Inline data: {blob[:500]}"
        )


def test_color_driven_by_calculate_transform(spec):
    calc_fields = _collect_calculate_as_fields(spec)
    assert calc_fields, (
        "The spec must contain at least one `calculate` transform that produces a field."
    )
    color_fields = _collect_color_fields(spec)
    assert color_fields, "A `color` encoding referencing a field is required."
    shared = calc_fields & color_fields
    assert shared, (
        "The color encoding must reference a field produced by a `calculate` transform "
        f"(increase/decrease computed in-spec). calculate outputs={sorted(calc_fields)}, "
        f"color fields={sorted(color_fields)}"
    )


def test_render_succeeds(svg):
    assert isinstance(svg, str) and svg.lstrip().startswith("<svg"), (
        "The Vega-Lite spec must render to a valid SVG via vl-convert."
    )


def test_six_lines_two_endpoints_each(svg):
    lines = _line_paths(svg)
    assert len(lines) == 6, (
        f"Expected exactly 6 region line marks (one per region); found {len(lines)}. "
        "Ensure each region is drawn as its own line."
    )
    for d, _ in lines:
        vertices = 1 + len(re.findall(r"[Ll]", d))
        assert vertices == 2, (
            "Each region line must connect exactly two x positions (2023 and 2024); "
            f"found a line path with {vertices} vertices: {d[:80]}"
        )


def test_lines_colored_into_two_groups(svg):
    lines = _line_paths(svg)
    strokes = {stroke for _, stroke in lines if stroke}
    assert len(strokes) == 2, (
        "The region lines must be colored into exactly two groups "
        f"(increased vs decreased); found {len(strokes)} distinct stroke colors: {strokes}"
    )


def test_endpoint_value_labels_rendered(svg):
    text = _svg_text_content(svg)
    present = [v for v in ENDPOINT_LABEL_VALUES if v in text]
    assert len(present) >= 3, (
        "The text-mark labels must show endpoint revenue values. Expected several of "
        f"{ENDPOINT_LABEL_VALUES} to appear in the rendered SVG text; found {present}."
    )
