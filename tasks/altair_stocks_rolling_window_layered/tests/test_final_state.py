import json
import os

import pytest

PROJECT_DIR = "/home/user/altair-stocks"
CHART_PATH = os.path.join(PROJECT_DIR, "chart.html")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _read_html():
    assert os.path.isfile(CHART_PATH), \
        f"Output file {CHART_PATH} does not exist; the chart HTML was not produced."
    with open(CHART_PATH, "r", encoding="utf-8") as f:
        return f.read()


def _extract_spec(html):
    """Extract the embedded Vega-Lite spec JSON object from the HTML.

    The Altair HTML template assigns the specification to a JS variable (e.g.
    `const spec = {...};` or `var spec = {...};`) immediately before invoking
    `vegaEmbed('#vis', spec, ...)`. We anchor on that assignment (rather than on
    `"$schema"`, which also appears inside the inlined JS libraries) and perform
    string-aware brace matching over the clean JSON payload.
    """
    call_idx = html.find("vegaEmbed(")
    assert call_idx != -1, "No vegaEmbed() call found in the HTML; it does not look like an Altair chart."

    assign_idx = html.rfind("spec = {", 0, call_idx)
    assert assign_idx != -1, "Could not locate the embedded 'spec = {...}' assignment in the HTML."

    start = html.index("{", assign_idx)

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
    assert end is not None, "Could not brace-match the embedded spec object."
    raw = html[start:end]
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:  # pragma: no cover
        raise AssertionError(f"Embedded spec is not valid JSON: {exc}")


def _walk(obj):
    """Yield every dict/list node in a nested JSON-like structure."""
    yield obj
    if isinstance(obj, dict):
        for v in obj.values():
            yield from _walk(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk(v)


def _find_window_transforms(spec):
    windows = []
    for node in _walk(spec):
        if isinstance(node, dict) and "window" in node and isinstance(node["window"], list):
            windows.append(node)
    return windows


def _find_encodings(spec):
    encs = []
    for node in _walk(spec):
        if isinstance(node, dict) and "encoding" in node and isinstance(node["encoding"], dict):
            encs.append(node["encoding"])
    return encs


def _mark_type(mark):
    if isinstance(mark, str):
        return mark
    if isinstance(mark, dict):
        return mark.get("type")
    return None


def _mark_opacity(mark):
    if isinstance(mark, dict):
        return mark.get("opacity")
    return None


@pytest.fixture(scope="module")
def spec():
    html = _read_html()
    return _extract_spec(html)


# ---------------------------------------------------------------------------
# Verification steps
# ---------------------------------------------------------------------------
def test_html_exists_and_is_offline():
    """Step 1: standalone HTML that embeds a spec and has no CDN references."""
    html = _read_html()
    assert "$schema" in html, "The HTML does not embed a Vega-Lite specification."
    assert "vegaEmbed" in html, "The HTML does not appear to use vegaEmbed to render the chart."
    assert "cdn.jsdelivr.net" not in html, \
        "The HTML references an external CDN (cdn.jsdelivr.net); it must be a fully offline standalone file."


def test_inline_data_no_remote_url(spec):
    """Step 2: inline embedded data, no remote url, three symbols, many rows."""
    datasets = spec.get("datasets")
    assert isinstance(datasets, dict) and len(datasets) > 0, \
        "The spec has no non-empty top-level 'datasets' mapping; data must be embedded inline."

    # No remote data URL anywhere in the spec.
    for node in _walk(spec):
        if isinstance(node, dict) and "url" in node and isinstance(node["url"], str):
            assert not node["url"].startswith(("http://", "https://")), \
                f"The spec references a remote data url ({node['url']}); data must be embedded locally."

    # Collect all embedded rows across datasets.
    rows = []
    for value in datasets.values():
        if isinstance(value, list):
            rows.extend(r for r in value if isinstance(r, dict))
    assert len(rows) > 100, \
        f"Expected more than 100 embedded data rows, found {len(rows)}."

    symbols = {r.get("symbol") for r in rows if "symbol" in r}
    for sym in ("AAPL", "GOOG", "MSFT"):
        assert sym in symbols, \
            f"Embedded data is missing expected symbol '{sym}' (found: {sorted(s for s in symbols if s)})."


def test_layered_chart(spec):
    """Step 3: layered chart with at least two layers."""
    layers = spec.get("layer")
    assert isinstance(layers, list) and len(layers) >= 2, \
        f"Expected a layered chart with at least 2 layers, found: {layers!r}"


def test_window_transform_rolling_mean(spec):
    """Step 4: window transform computing mean(price) grouped by symbol with a frame."""
    windows = _find_window_transforms(spec)
    assert windows, "No window transform (transform_window) found in the spec."

    matched = False
    for wt in windows:
        fields = wt["window"]
        has_mean_price = any(
            isinstance(w, dict)
            and w.get("op") == "mean"
            and w.get("field") == "price"
            for w in fields
        )
        groupby = wt.get("groupby") or []
        has_symbol_group = "symbol" in groupby
        frame = wt.get("frame")
        has_frame = isinstance(frame, list) and len(frame) == 2
        if has_mean_price and has_symbol_group and has_frame:
            matched = True
            break
    assert matched, (
        "No window transform computing mean(price) grouped by 'symbol' with a "
        "two-element 'frame' was found."
    )


def test_layers_have_lines_with_light_raw(spec):
    """Step 5: at least two line layers, one raw line with reduced opacity (<1)."""
    layers = spec.get("layer", [])
    line_layers = [ly for ly in layers if isinstance(ly, dict) and _mark_type(ly.get("mark")) == "line"]
    assert len(line_layers) >= 2, \
        f"Expected at least two line layers (raw price + rolling mean), found {len(line_layers)}."

    light_line = False
    for ly in line_layers:
        opacity = _mark_opacity(ly.get("mark"))
        if isinstance(opacity, (int, float)) and opacity < 1:
            light_line = True
            break
    assert light_line, \
        "No line layer with reduced mark opacity (<1) found; the raw price line must be rendered lighter."


def test_color_by_symbol_and_tooltip(spec):
    """Step 6: color encoded by 'symbol' (legend) and tooltip encoding present."""
    encodings = _find_encodings(spec)
    assert encodings, "No encoding blocks found in the spec."

    color_symbol = False
    tooltip_present = False
    for enc in encodings:
        color = enc.get("color")
        if isinstance(color, dict) and color.get("field") == "symbol":
            color_symbol = True
        if "tooltip" in enc and enc["tooltip"] is not None:
            tooltip_present = True

    assert color_symbol, "No 'color' encoding on the 'symbol' field was found (needed for the legend)."
    assert tooltip_present, "No 'tooltip' encoding found in the spec."


def test_interactive_pan_zoom(spec):
    """Step 7: interval selection parameter bound to scales."""
    bind_scales = False
    for node in _walk(spec):
        if isinstance(node, dict) and node.get("bind") == "scales":
            bind_scales = True
            break
    assert bind_scales, \
        "No interval selection bound to scales ('bind': 'scales') found; pan/zoom must be enabled."
