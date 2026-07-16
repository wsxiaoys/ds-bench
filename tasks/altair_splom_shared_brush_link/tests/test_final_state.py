import json
import os
import re
import socket

import pytest
import requests
from pochi_verifier import PochiVerifier
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/altair_splom"
CHART_HTML = os.path.join(PROJECT_DIR, "chart.html")

EXPECTED_FEATURES = {"temperature", "pressure", "humidity", "vibration"}
CATEGORICAL_FIELD = "machine_class"

HOST = "127.0.0.1"
PORT = 8123
BASE_URL = f"http://{HOST}:{PORT}"
CHART_URL = f"{BASE_URL}/chart.html"


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _read_html():
    assert os.path.isfile(CHART_HTML), f"Expected artifact {CHART_HTML} does not exist."
    with open(CHART_HTML, encoding="utf-8") as f:
        html = f.read()
    assert html.strip(), "chart.html is empty."
    return html


def _extract_spec(html):
    """Extract the Vega-Lite spec object assigned to the `spec` JS variable."""
    m = re.search(r"(?:var|let|const)\s+spec\s*=\s*", html)
    assert m is not None, "Could not find a `spec` variable assignment in chart.html."
    brace_idx = html.index("{", m.end())
    spec, _ = json.JSONDecoder().raw_decode(html, brace_idx)
    return spec


def _mark_type(mark):
    if isinstance(mark, str):
        return mark
    if isinstance(mark, dict):
        return mark.get("type")
    return None


def _find_urls(node):
    urls = []
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "url" and isinstance(v, str):
                urls.append(v)
            else:
                urls.extend(_find_urls(v))
    elif isinstance(node, list):
        for item in node:
            urls.extend(_find_urls(item))
    return urls


def _find_interval_params(spec_node):
    """Collect all params that define an interval selection anywhere in the spec."""
    found = []

    def walk(node):
        if isinstance(node, dict):
            params = node.get("params")
            if isinstance(params, list):
                for p in params:
                    if isinstance(p, dict):
                        select = p.get("select")
                        sel_type = select.get("type") if isinstance(select, dict) else select
                        if sel_type == "interval":
                            found.append(p)
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(spec_node)
    return found


# --------------------------------------------------------------------------- #
# Static spec checks
# --------------------------------------------------------------------------- #
def test_chart_html_references_vega_embed():
    html = _read_html()
    assert "vegaEmbed" in html, "chart.html does not appear to embed the chart via vegaEmbed."


def test_spec_is_repeat_splom():
    spec = _extract_spec(_read_html())
    assert "repeat" in spec, "Top-level spec is not a repeat chart (missing `repeat`)."
    repeat = spec["repeat"]
    assert isinstance(repeat, dict) and "row" in repeat and "column" in repeat, (
        "Repeat definition must contain both `row` and `column` arrays for a SPLOM."
    )
    assert set(repeat["row"]) == EXPECTED_FEATURES, (
        f"Repeat `row` must be exactly {EXPECTED_FEATURES}, got {repeat['row']}."
    )
    assert set(repeat["column"]) == EXPECTED_FEATURES, (
        f"Repeat `column` must be exactly {EXPECTED_FEATURES}, got {repeat['column']}."
    )
    assert isinstance(spec.get("spec"), dict), "Repeat chart is missing the nested `spec` object."


def test_nested_spec_encodings_are_quantitative_repeat():
    spec = _extract_spec(_read_html())
    nested = spec["spec"]
    assert _mark_type(nested.get("mark")) in {"point", "circle"}, (
        f"Mark must be a point-like mark (point/circle), got {nested.get('mark')}."
    )
    enc = nested.get("encoding", {})
    x, y = enc.get("x", {}), enc.get("y", {})
    assert x.get("field") == {"repeat": "column"}, (
        f"x encoding must bind to the repeated column field, got {x.get('field')}."
    )
    assert y.get("field") == {"repeat": "row"}, (
        f"y encoding must bind to the repeated row field, got {y.get('field')}."
    )
    assert x.get("type") == "quantitative", f"x encoding must be quantitative, got {x.get('type')}."
    assert y.get("type") == "quantitative", f"y encoding must be quantitative, got {y.get('type')}."


def test_single_shared_interval_brush():
    spec = _extract_spec(_read_html())
    intervals = _find_interval_params(spec)
    assert len(intervals) == 1, (
        f"Expected exactly one shared interval selection, found {len(intervals)}."
    )
    assert intervals[0].get("name"), "The interval selection parameter must have a name."


def test_color_conditional_on_brush():
    spec = _extract_spec(_read_html())
    intervals = _find_interval_params(spec)
    param_name = intervals[0]["name"]
    color = spec["spec"].get("encoding", {}).get("color", {})
    condition = color.get("condition")
    assert isinstance(condition, dict), (
        f"color encoding must use a single conditional definition, got {condition}."
    )
    assert condition.get("param") == param_name, (
        f"color condition must reference the brush param '{param_name}', got {condition.get('param')}."
    )
    assert condition.get("field") == CATEGORICAL_FIELD, (
        f"Highlighted color must encode the '{CATEGORICAL_FIELD}' field, got {condition.get('field')}."
    )
    assert condition.get("type") == "nominal", (
        f"The categorical color field must be nominal, got {condition.get('type')}."
    )
    value = str(color.get("value", "")).lower().replace(" ", "")
    assert value in {"lightgray", "lightgrey", "#d3d3d3", "grey", "gray", "#808080"}, (
        f"Non-selected points must fall back to a light-gray value, got {color.get('value')}."
    )


def test_data_is_offline_inline():
    spec = _extract_spec(_read_html())
    urls = _find_urls(spec)
    remote = [u for u in urls if u.startswith("http://") or u.startswith("https://")]
    assert not remote, f"Spec must not reference remote data URLs, found: {remote}."
    has_inline = "datasets" in spec or bool(_find_inline_values(spec))
    assert has_inline, "Spec must embed the data inline (datasets or values), not by external reference."


def _find_inline_values(node):
    if isinstance(node, dict):
        if isinstance(node.get("values"), list):
            return True
        return any(_find_inline_values(v) for v in node.values())
    if isinstance(node, list):
        return any(_find_inline_values(item) for item in node)
    return False


def test_html_is_self_contained_offline():
    html = _read_html().lower()
    remote_cdns = ["cdn.jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com"]
    offending = [c for c in remote_cdns if c in html]
    assert not offending, (
        f"chart.html must be fully self-contained (offline); found remote CDN references: {offending}."
    )


# --------------------------------------------------------------------------- #
# Browser render verification
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def serve_chart(xprocess):
    class Starter(ProcessStarter):
        name = "serve_chart"
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
                resp = requests.get(CHART_URL, timeout=10)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        with open(info.logpath, "r") as f:
            lines = f.readlines()
        new = lines[printed:]
        printed = len(lines)
        print(f"============== [{tag}] {Starter.name} log ==============")
        print("".join(new))
        print(f"============== [{tag}] end log ==============")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def test_chart_renders_in_browser(serve_chart, browser_verifier):
    reason = (
        "The saved chart.html is a Vega-Altair scatterplot matrix (SPLOM). When opened in a "
        "browser it must render a grid of scatter plots (one panel per pair of the four "
        "quantitative features), showing colored point marks, with no rendering errors."
    )
    truth = (
        f"Navigate to {CHART_URL}. Verify that the page renders a scatterplot matrix: a grid "
        "of multiple scatter-plot panels is drawn (not a blank page and not an error message), "
        "with many point/circle marks visible inside the panels. Verify that no Vega/Vega-Lite "
        "error text (for example 'Javascript Error', 'Uncaught', or a red error box) is shown on "
        "the page."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_chart_renders_in_browser",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
