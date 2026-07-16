import json
import os
import socket

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"
HTML_PATH = os.path.join(PROJECT_DIR, "gapminder.html")

REQUIRED_KEYS = {
    "year",
    "country",
    "region",
    "gdp_per_capita",
    "life_expectancy",
    "population",
}

# Serve the static artifact over IPv4 explicitly. Using 127.0.0.1 avoids the
# IPv6 loopback (::1) mismatch that can make readiness checks hang.
HOST = "127.0.0.1"
PORT = 8123
BASE_URL = f"http://{HOST}:{PORT}"
PAGE_URL = f"{BASE_URL}/gapminder.html"


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _read_html():
    assert os.path.isfile(HTML_PATH), f"Expected output HTML at {HTML_PATH}, but it was not found."
    with open(HTML_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert content.strip(), f"{HTML_PATH} exists but is empty."
    return content


def _extract_spec(html):
    """Extract the Vega-Lite spec JSON object passed to vegaEmbed.

    Altair's HTML template embeds the spec as `var spec = {...};`. We locate the
    marker and brace-match to pull out the full JSON object (handling nested
    braces and quoted strings robustly).
    """
    marker = "vegaEmbed"
    # The spec is assigned to a JS variable before the vegaEmbed call. Find the
    # first '{' that follows a `spec =` assignment.
    idx = html.find("spec =")
    if idx == -1:
        idx = html.find("spec=")
    assert idx != -1, "Could not locate the embedded Vega-Lite spec assignment in the HTML."
    start = html.find("{", idx)
    assert start != -1, "Could not locate the start of the embedded Vega-Lite spec object."

    depth = 0
    in_string = False
    escape = False
    end = None
    for i in range(start, len(html)):
        ch = html[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    assert end is not None, "Could not brace-match the embedded Vega-Lite spec object."
    # Sanity: the vegaEmbed call should appear somewhere in the doc.
    assert marker in html, "The HTML does not appear to embed the chart via vegaEmbed."
    spec_text = html[start : end + 1]
    return json.loads(spec_text)


def _get_rows(spec):
    data = spec.get("data", {})
    if isinstance(data, dict) and isinstance(data.get("values"), list):
        return data["values"]
    datasets = spec.get("datasets")
    if isinstance(datasets, dict) and datasets:
        name = data.get("name") if isinstance(data, dict) else None
        if name and name in datasets and isinstance(datasets[name], list):
            return datasets[name]
        for value in datasets.values():
            if isinstance(value, list):
                return value
    return []


def _iter_encodings(spec):
    """Yield encoding dicts from a (possibly composed) spec."""
    if isinstance(spec, dict):
        enc = spec.get("encoding")
        if isinstance(enc, dict):
            yield enc
        for key in ("layer", "hconcat", "vconcat", "concat"):
            children = spec.get(key)
            if isinstance(children, list):
                for child in children:
                    yield from _iter_encodings(child)
        for key in ("spec", "facet"):
            child = spec.get(key)
            if isinstance(child, dict):
                yield from _iter_encodings(child)


def _find_channel(spec, channel):
    for enc in _iter_encodings(spec):
        if channel in enc:
            return enc[channel]
    return None


def _iter_params(spec):
    if isinstance(spec, dict):
        params = spec.get("params")
        if isinstance(params, list):
            for p in params:
                if isinstance(p, dict):
                    yield p
        for key in ("layer", "hconcat", "vconcat", "concat"):
            children = spec.get(key)
            if isinstance(children, list):
                for child in children:
                    yield from _iter_params(child)
        for key in ("spec",):
            child = spec.get(key)
            if isinstance(child, dict):
                yield from _iter_params(child)


def _iter_transforms(spec):
    if isinstance(spec, dict):
        transforms = spec.get("transform")
        if isinstance(transforms, list):
            for t in transforms:
                yield t
        for key in ("layer", "hconcat", "vconcat", "concat"):
            children = spec.get(key)
            if isinstance(children, list):
                for child in children:
                    yield from _iter_transforms(child)
        for key in ("spec",):
            child = spec.get(key)
            if isinstance(child, dict):
                yield from _iter_transforms(child)


@pytest.fixture(scope="session")
def spec():
    html = _read_html()
    return _extract_spec(html)


# --------------------------------------------------------------------------- #
# Static spec checks
# --------------------------------------------------------------------------- #
def test_html_artifact_exists():
    html = _read_html()
    assert "vegaEmbed" in html, "The HTML file does not embed a chart via vegaEmbed."


def test_no_external_data_url():
    html = _read_html()
    spec = _extract_spec(html)
    # The chart data must be embedded inline, never referenced by a remote URL.
    spec_str = json.dumps(spec)
    assert '"url"' not in spec_str, (
        "The Vega-Lite spec references data by URL; the dataset must be embedded inline "
        "for a fully offline artifact."
    )
    assert "vega-datasets" not in html, (
        "The artifact references the remote vega-datasets source; all data must be local."
    )
    # Offline requirement: the JS runtime must be bundled inline, not loaded from a CDN.
    assert "cdn.jsdelivr.net" not in html and "unpkg.com" not in html, (
        "The HTML loads JavaScript from a CDN; save with inline dependencies so the file "
        "works with no network access."
    )


def test_inline_data_years_and_regions(spec):
    rows = _get_rows(spec)
    assert rows, "No inline data rows were found in the embedded spec."
    years = {r.get("year") for r in rows if isinstance(r, dict)}
    regions = {r.get("region") for r in rows if isinstance(r, dict)}
    years.discard(None)
    regions.discard(None)
    assert len(years) >= 5, (
        f"Expected at least 5 distinct years in the data, found {sorted(str(y) for y in years)}."
    )
    assert len(regions) >= 4, (
        f"Expected at least 4 distinct regions in the data, found {sorted(str(r) for r in regions)}."
    )


def test_row_schema(spec):
    rows = _get_rows(spec)
    assert rows, "No inline data rows were found in the embedded spec."
    for row in rows:
        assert isinstance(row, dict), f"Expected each data row to be an object, got {type(row)}."
        missing = REQUIRED_KEYS - set(row.keys())
        assert not missing, f"Data row is missing required keys {missing}: {row}"


def test_x_uses_log_scale_on_gdp(spec):
    x = _find_channel(spec, "x")
    assert x is not None, "No x encoding found in the chart spec."
    assert x.get("field") == "gdp_per_capita", (
        f"The x-channel must encode 'gdp_per_capita', found field={x.get('field')!r}."
    )
    scale = x.get("scale")
    assert isinstance(scale, dict) and scale.get("type") == "log", (
        f"The x-channel must use a logarithmic scale (scale.type == 'log'), found scale={scale!r}."
    )


def test_y_encodes_life_expectancy(spec):
    y = _find_channel(spec, "y")
    assert y is not None, "No y encoding found in the chart spec."
    assert y.get("field") == "life_expectancy", (
        f"The y-channel must encode 'life_expectancy', found field={y.get('field')!r}."
    )


def test_size_and_color_encodings(spec):
    size = _find_channel(spec, "size")
    color = _find_channel(spec, "color")
    assert size is not None and size.get("field") == "population", (
        f"The size channel must encode 'population', found {size!r}."
    )
    assert color is not None and color.get("field") == "region", (
        f"The color channel must encode 'region', found {color!r}."
    )


def test_tooltip_present(spec):
    tooltip = _find_channel(spec, "tooltip")
    assert tooltip is not None, "The chart must define a tooltip encoding."
    if isinstance(tooltip, list):
        fields = {t.get("field") for t in tooltip if isinstance(t, dict)}
    elif isinstance(tooltip, dict):
        fields = {tooltip.get("field")}
    else:
        fields = set()
    assert "country" in fields, (
        f"The tooltip must reference 'country', found tooltip fields {fields}."
    )


def test_year_slider_param(spec):
    slider_params = [
        p
        for p in _iter_params(spec)
        if isinstance(p.get("bind"), dict) and p["bind"].get("input") == "range"
    ]
    assert slider_params, (
        "No range-slider parameter (bind.input == 'range') was found; a year slider is required."
    )


def test_filter_by_selected_year(spec):
    slider_params = [
        p
        for p in _iter_params(spec)
        if isinstance(p.get("bind"), dict) and p["bind"].get("input") == "range"
    ]
    assert slider_params, "No range-slider parameter was found to drive the year filter."

    filters = [t.get("filter") for t in _iter_transforms(spec) if isinstance(t, dict) and "filter" in t]
    assert filters, "No filter transform was found; the chart must filter to the selected year."

    matched = False
    for param in slider_params:
        pname = param.get("name")
        if not pname:
            continue
        param_dump = json.dumps(param)
        for f in filters:
            fdump = json.dumps(f)
            uses_param = pname in fdump
            year_linked = ("year" in fdump) or ("year" in param_dump)
            if uses_param and year_linked:
                matched = True
                break
        if matched:
            break
    assert matched, (
        "Expected a filter transform that references the year slider parameter and the 'year' "
        "field, so that only the selected year's bubbles are displayed."
    )


# --------------------------------------------------------------------------- #
# Browser verification
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def serve_html(xprocess):
    class Starter(ProcessStarter):
        name = "serve_html"
        args = ["python3", "-m", "http.server", str(PORT), "--bind", HOST]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 60
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(PAGE_URL, timeout=10)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        try:
            with open(info.logpath, "r") as f:
                all_lines = f.readlines()
        except OSError:
            return
        new_lines = all_lines[printed:]
        printed = len(all_lines)
        print(f"===== [{tag}] {Starter.name} log =====")
        print("".join(new_lines))
        print(f"===== [{tag}] end {Starter.name} log =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield PAGE_URL

    capture_logs("TEARDOWN")
    info.terminate()


def test_chart_renders_in_browser(serve_html, browser_verifier):
    reason = (
        "The saved HTML should render a Gapminder-style interactive bubble chart with an "
        "interactive year slider. The chart plots GDP per capita (log x-axis) against life "
        "expectancy, with bubble size for population and color for region, filtered by a year slider."
    )
    truth = (
        f"Navigate to {serve_html}. Verify that a scatter/bubble chart is rendered with multiple "
        "circular point marks visible (an SVG or canvas containing several bubbles). Verify that a "
        "range slider input control (the year slider) is present on the page. Confirm the page loads "
        "without JavaScript errors and without any failed external network requests for chart data."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_chart_renders_in_browser",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
