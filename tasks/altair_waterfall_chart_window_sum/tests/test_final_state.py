import json
import os
import re
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"
GENERATE_CMD = ["python3", "generate_waterfall.py"]
OUTPUT_HTML = os.path.join(PROJECT_DIR, "waterfall.html")

HOST = "127.0.0.1"
PORT = 8000
BASE_URL = f"http://{HOST}:{PORT}"

EXPECTED_LABELS = [
    "Begin",
    "Product A",
    "Product B",
    "Services",
    "Refunds",
    "Tax",
    "End",
]
# Cumulative running totals implied by the input deltas.
EXPECTED_CUMULATIVE = [4000, 5200, 4400, 5900, 5300, 4400, 4400]
EXPECTED_GRAND_TOTAL = 4400


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def _balanced_json(text, start):
    """Return the substring of a balanced {...} JSON object starting at index `start`."""
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        c = text[i]
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
                    return text[start : i + 1]
    return None


def _extract_spec(html):
    """Extract the inline Vega-Lite spec object embedded by Altair's HTML export."""
    match = re.search(r"var\s+spec\s*=\s*", html)
    assert match is not None, (
        "Could not find an inline Vega-Lite spec (`var spec = ...`) in the exported HTML."
    )
    brace_start = html.find("{", match.end())
    assert brace_start != -1, "Could not locate the start of the Vega-Lite spec object."
    raw = _balanced_json(html, brace_start)
    assert raw is not None, "Could not extract a balanced JSON object for the spec."
    return json.loads(raw)


def _iter_dicts(obj):
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from _iter_dicts(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _iter_dicts(v)


def _unit_specs(spec):
    for d in _iter_dicts(spec):
        if isinstance(d, dict) and "mark" in d and "encoding" in d:
            yield d


def _mark_type(unit):
    mark = unit["mark"]
    if isinstance(mark, str):
        return mark
    if isinstance(mark, dict):
        return mark.get("type")
    return None


def _collect_transforms(spec):
    transforms = []
    for d in _iter_dicts(spec):
        t = d.get("transform")
        if isinstance(t, list):
            transforms.extend(x for x in t if isinstance(x, dict))
    return transforms


def _collect_data_rows(spec):
    return [
        d
        for d in _iter_dicts(spec)
        if isinstance(d, dict) and {"label", "amount"}.issubset(d.keys())
    ]


def _collect_colors(color_enc):
    colors = set()
    cond = color_enc.get("condition")
    if isinstance(cond, list):
        for c in cond:
            if isinstance(c, dict) and isinstance(c.get("value"), str):
                colors.add(c["value"])
    elif isinstance(cond, dict) and isinstance(cond.get("value"), str):
        colors.add(cond["value"])
    if isinstance(color_enc.get("value"), str):
        colors.add(color_enc["value"])
    scale = color_enc.get("scale")
    if isinstance(scale, dict) and isinstance(scale.get("range"), list):
        for r in scale["range"]:
            if isinstance(r, str):
                colors.add(r)
    return colors


# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------
@pytest.fixture(scope="session")
def chart_html():
    """Regenerate the chart by running the executor's command, then return the HTML."""
    if os.path.exists(OUTPUT_HTML):
        os.remove(OUTPUT_HTML)

    result = subprocess.run(
        GENERATE_CMD,
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=180,
    )
    assert result.returncode == 0, (
        f"Running '{' '.join(GENERATE_CMD)}' failed (exit {result.returncode}).\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert os.path.isfile(OUTPUT_HTML), (
        f"Expected output file {OUTPUT_HTML} to be created by the generation command."
    )
    with open(OUTPUT_HTML, encoding="utf-8") as f:
        html = f.read()
    assert html.strip(), f"Output file {OUTPUT_HTML} is empty."
    return html


@pytest.fixture(scope="session")
def spec(chart_html):
    return _extract_spec(chart_html)


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def http_server(chart_html, xprocess):
    """Serve the project directory over HTTP so the exported chart can be rendered."""

    class Starter(ProcessStarter):
        name = "waterfall_http_server"
        args = ["python3", "-m", "http.server", str(PORT), "--bind", HOST]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 60
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(f"{BASE_URL}/waterfall.html", timeout=15)
                return resp.status_code == 200
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        try:
            with open(info.logpath) as f:
                print("=== http.server log ===")
                print(f.read())
        except OSError:
            pass

    assert started, "Failed to start the HTTP server for browser verification."
    yield BASE_URL
    info.terminate()


# --------------------------------------------------------------------------
# Tests
# --------------------------------------------------------------------------
def test_html_embeds_vega_lite_spec(chart_html):
    """Truth 1: HTML artifact exists and embeds a Vega-Lite spec via vegaEmbed."""
    assert "vegaEmbed" in chart_html, (
        "Exported HTML does not contain a 'vegaEmbed' call; it may not be a "
        "standalone Altair/Vega-Lite HTML page."
    )
    spec = _extract_spec(chart_html)
    assert isinstance(spec, dict) and spec, "Embedded Vega-Lite spec is not a JSON object."


def test_data_is_local_no_network(spec):
    """Truth 2: data must be local; no http(s) URL used as a data source."""
    for d in _iter_dicts(spec):
        data = d.get("data")
        if isinstance(data, dict):
            url = data.get("url")
            if isinstance(url, str):
                assert not url.lower().startswith(("http://", "https://")), (
                    f"Data source uses a remote URL ({url}); the task must use only local data."
                )

    rows = _collect_data_rows(spec)
    assert rows, "Could not find inline data rows (with 'label' and 'amount') in the spec."
    labels_found = {r["label"] for r in rows}
    for label in EXPECTED_LABELS:
        assert label in labels_found, (
            f"Expected label '{label}' to be present in the chart's inline data; "
            f"found labels: {sorted(labels_found)}."
        )


def test_window_sum_transform(spec):
    """Truth 3: a window transform computes sum over the 'amount' field."""
    transforms = _collect_transforms(spec)
    found = False
    for t in transforms:
        window = t.get("window")
        if isinstance(window, list):
            for w in window:
                if isinstance(w, dict) and w.get("op") == "sum" and w.get("field") == "amount":
                    found = True
    assert found, (
        "Expected a window transform with op 'sum' over field 'amount' "
        "(the running cumulative total) in the spec."
    )


def test_calculate_transform_present(spec):
    """Truth 4: at least one calculate transform is used to derive bar positions."""
    transforms = _collect_transforms(spec)
    found = any("calculate" in t for t in transforms)
    assert found, "Expected at least one 'calculate' transform in the spec."


def test_floating_bars_with_y_and_y2(spec):
    """Truth 5: a bar mark uses both y and y2 (floating bars)."""
    bar_units = [u for u in _unit_specs(spec) if _mark_type(u) == "bar"]
    assert bar_units, "No 'bar' mark found in the layered chart."
    ok = any(
        "y" in u.get("encoding", {}) and "y2" in u.get("encoding", {}) for u in bar_units
    )
    assert ok, (
        "Expected a bar mark whose encoding uses both 'y' (start) and 'y2' (end) "
        "so the bars float between the previous and new cumulative totals."
    )


def test_three_way_color_coding(spec):
    """Truth 6: bar color coding distinguishes increase, decrease, and baseline/total."""
    bar_units = [u for u in _unit_specs(spec) if _mark_type(u) == "bar"]
    assert bar_units, "No 'bar' mark found in the layered chart."

    for u in bar_units:
        color_enc = u.get("encoding", {}).get("color")
        if not isinstance(color_enc, dict):
            continue
        colors = _collect_colors(color_enc)
        if len(colors) >= 3:
            return
        # Field-based categorical color encoding also yields distinct colors per category.
        if color_enc.get("field") and color_enc.get("type") in ("nominal", "ordinal"):
            return
        scale = color_enc.get("scale")
        if isinstance(scale, dict) and isinstance(scale.get("domain"), list):
            if len(scale["domain"]) >= 3:
                return

    pytest.fail(
        "Bar color encoding does not distinguish at least three cases "
        "(increase / decrease / baseline-total)."
    )


def test_text_label_layer(spec):
    """Truth 7: the layered chart includes a text mark for per-step delta labels."""
    text_units = [u for u in _unit_specs(spec) if _mark_type(u) == "text"]
    assert text_units, (
        "Expected at least one 'text' mark (delta labels) layered onto the chart."
    )


def test_cumulative_math_consistent(spec):
    """Truth 8: the chart's data implies the expected running totals and grand total."""
    rows = _collect_data_rows(spec)
    # Deduplicate rows by (label, amount) preserving first-seen order matching the input.
    by_label = {}
    for r in rows:
        by_label.setdefault(r["label"], r)
    ordered = [by_label[label] for label in EXPECTED_LABELS if label in by_label]
    assert len(ordered) == len(EXPECTED_LABELS), (
        f"Expected inline data for all labels {EXPECTED_LABELS}, "
        f"found {[r['label'] for r in ordered]}."
    )

    amounts = [int(r["amount"]) for r in ordered]
    running = []
    total = 0
    for amt in amounts:
        total += amt
        running.append(total)
    assert running == EXPECTED_CUMULATIVE, (
        f"Running cumulative totals from the chart data {running} do not match "
        f"the expected {EXPECTED_CUMULATIVE}."
    )
    assert running[-1] == EXPECTED_GRAND_TOTAL, (
        f"Grand total (End bar) should reach {EXPECTED_GRAND_TOTAL}, got {running[-1]}."
    )


def test_browser_render(http_server, browser_verifier):
    """Truth 9: the exported chart renders in a browser with bars, labels, and no error."""
    url = f"{http_server}/waterfall.html"
    reason = (
        "The exported HTML must render a waterfall chart of sequential cash-flow deltas: "
        "a sequence of floating bars connecting a starting balance to an ending total, "
        "with bars colored to distinguish increases, decreases, and the baseline/total, "
        "plus text labels showing each step's delta amount."
    )
    truth = (
        f"Navigate to {url} and wait a few seconds for the Vega-Lite chart to finish "
        "rendering. Verify that a waterfall bar chart is displayed with multiple bars of "
        "more than one color and with text labels showing numeric amounts. Confirm the "
        "delta amounts are visible in the rendered chart (for example, the numbers 1200 "
        "and 1500 appear, possibly formatted with a thousands separator such as 1,200). "
        "Confirm the page does not show a JavaScript/Vega error message and the chart area "
        "is not blank."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_render",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
