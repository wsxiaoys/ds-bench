import csv
import json
import os
import re
import socket
import subprocess
from collections import Counter

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"
BUILD_SCRIPT = os.path.join(PROJECT_DIR, "build_bump_chart.py")
OUTPUT_HTML = os.path.join(PROJECT_DIR, "chart.html")
DATA_FILE = os.path.join(PROJECT_DIR, "data", "product_sales.csv")

HOST = "127.0.0.1"
PORT = 8000
BASE_URL = f"http://{HOST}:{PORT}"


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _walk(obj):
    """Yield every dict node inside a nested JSON structure."""
    if isinstance(obj, dict):
        yield obj
        for value in obj.values():
            yield from _walk(value)
    elif isinstance(obj, list):
        for item in obj:
            yield from _walk(item)


def _match_braces(text, start):
    """Return the substring of a balanced {...} block starting at index `start`."""
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
            if c in ("\"", "'"):
                in_str = True
                quote = c
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return text[start:i + 1]
    raise ValueError("Unbalanced braces while extracting the Vega-Lite spec.")


def _extract_spec(html):
    """Pull the embedded Vega-Lite specification JSON out of an Altair HTML file."""
    m = re.search(r"var\s+spec\s*=\s*", html)
    if m is not None:
        start = html.index("{", m.end())
        return json.loads(_match_braces(html, start))
    # Fallback: locate the spec object by its $schema key.
    idx = html.find('"$schema"')
    assert idx != -1, "Could not locate a Vega-Lite specification in the HTML output."
    start = html.rfind("{", 0, idx)
    assert start != -1, "Could not locate the opening brace of the spec object."
    return json.loads(_match_braces(html, start))


def _load_csv_rows():
    rows = []
    with open(DATA_FILE, newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(
                (
                    str(r["period"]).strip(),
                    str(r["category"]).strip(),
                    float(r["sales"]),
                )
            )
    return rows


def _collect_embedded_rows(spec):
    """Gather all inline data rows carried by the spec (datasets + inline values)."""
    rows = []
    datasets = spec.get("datasets")
    if isinstance(datasets, dict):
        for values in datasets.values():
            if isinstance(values, list):
                rows.extend(values)
    for node in _walk(spec):
        data = node.get("data")
        if isinstance(data, dict) and isinstance(data.get("values"), list):
            rows.extend(data["values"])
    return rows


# --------------------------------------------------------------------------- #
# Build fixture (runs the executor's rerunnable command as described in truth)
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def spec():
    assert os.path.isfile(BUILD_SCRIPT), (
        f"Expected build script {BUILD_SCRIPT} to exist so the chart can be regenerated."
    )
    if os.path.isfile(OUTPUT_HTML):
        os.remove(OUTPUT_HTML)

    result = subprocess.run(
        ["python3", "build_bump_chart.py"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    print("STDOUT:\n" + result.stdout)
    print("STDERR:\n" + result.stderr)
    assert result.returncode == 0, (
        f"Running 'python3 build_bump_chart.py' failed with code {result.returncode}."
    )
    assert os.path.isfile(OUTPUT_HTML), (
        f"Expected output file {OUTPUT_HTML} to be created by the build script."
    )
    assert os.path.getsize(OUTPUT_HTML) > 0, f"{OUTPUT_HTML} is empty."

    with open(OUTPUT_HTML, encoding="utf-8") as f:
        html = f.read()
    assert "vegaEmbed" in html, (
        f"{OUTPUT_HTML} does not look like a standalone Altair/Vega-Lite HTML document "
        "(missing 'vegaEmbed')."
    )
    return _extract_spec(html)


# --------------------------------------------------------------------------- #
# HTTP server fixture for browser verification
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def serve_output(spec, xprocess):
    class Starter(ProcessStarter):
        name = "serve_output"
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
                resp = requests.get(f"{BASE_URL}/chart.html", timeout=10)
                return resp.status_code < 500
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
    yield BASE_URL
    info.terminate()


# --------------------------------------------------------------------------- #
# Structural checks on the generated spec
# --------------------------------------------------------------------------- #
def test_layered_line_and_point_marks(spec):
    mark_types = set()
    for node in _walk(spec):
        if "mark" in node:
            mark = node["mark"]
            if isinstance(mark, str):
                mark_types.add(mark)
            elif isinstance(mark, dict) and isinstance(mark.get("type"), str):
                mark_types.add(mark["type"])
    assert "line" in mark_types, f"Expected a 'line' mark in the layered chart, found marks: {mark_types}."
    assert "point" in mark_types, f"Expected a 'point' mark in the layered chart, found marks: {mark_types}."


def test_window_transform_computes_rank(spec):
    found = False
    for node in _walk(spec):
        window = node.get("window")
        if not isinstance(window, list):
            continue
        has_rank = any(
            isinstance(w, dict) and w.get("op") == "rank" and w.get("as") == "rank"
            for w in window
        )
        if not has_rank:
            continue
        sort = node.get("sort", [])
        sort_ok = isinstance(sort, list) and any(
            isinstance(s, dict) and s.get("field") == "sales" and s.get("order") == "descending"
            for s in sort
        )
        groupby = node.get("groupby", [])
        groupby_ok = isinstance(groupby, list) and "period" in groupby
        if sort_ok and groupby_ok:
            found = True
            break
    assert found, (
        "Expected a window transform with op 'rank' as field 'rank', sorted by 'sales' "
        "descending and grouped by 'period'."
    )


def test_y_encodes_reversed_rank(spec):
    y_ok = False
    for node in _walk(spec):
        enc = node.get("encoding")
        if not isinstance(enc, dict):
            continue
        y = enc.get("y")
        if isinstance(y, dict) and y.get("field") == "rank":
            scale = y.get("scale")
            if isinstance(scale, dict) and scale.get("reverse") is True:
                y_ok = True
                break
    assert y_ok, (
        "Expected the y channel to encode field 'rank' with a reversed scale "
        "(scale.reverse == true) so rank 1 is at the top."
    )


def test_color_encodes_category(spec):
    color_ok = False
    for node in _walk(spec):
        enc = node.get("encoding")
        if not isinstance(enc, dict):
            continue
        color = enc.get("color")
        if isinstance(color, dict) and color.get("field") == "category":
            color_ok = True
            break
    assert color_ok, "Expected the color channel to encode the 'category' field."


def test_tooltip_exposes_required_fields(spec):
    required = {"category", "period", "rank", "sales"}
    tooltip_ok = False
    for node in _walk(spec):
        enc = node.get("encoding")
        if not isinstance(enc, dict):
            continue
        tooltip = enc.get("tooltip")
        fields = set()
        if isinstance(tooltip, list):
            for t in tooltip:
                if isinstance(t, dict) and "field" in t:
                    fields.add(t["field"])
                elif isinstance(t, str):
                    fields.add(t.split(":")[0])
        elif isinstance(tooltip, dict) and "field" in tooltip:
            fields.add(tooltip["field"])
        if required <= fields:
            tooltip_ok = True
            break
    assert tooltip_ok, (
        f"Expected a tooltip encoding referencing all of {sorted(required)}."
    )


def test_no_remote_data_url(spec):
    for node in _walk(spec):
        data = node.get("data")
        if isinstance(data, dict):
            assert "url" not in data, (
                "The spec references a remote dataset URL; all data must be embedded locally."
            )


def test_embedded_data_matches_local_csv(spec):
    expected = _load_csv_rows()
    embedded = _collect_embedded_rows(spec)
    parsed = []
    for row in embedded:
        if not isinstance(row, dict):
            continue
        if {"period", "category", "sales"} <= set(row.keys()):
            parsed.append(
                (str(row["period"]).strip(), str(row["category"]).strip(), float(row["sales"]))
            )
    assert parsed, "No inline rows with period/category/sales were embedded in the HTML spec."
    assert Counter(parsed) == Counter(expected), (
        "The data embedded in the HTML does not match the local CSV dataset "
        f"(expected {len(expected)} rows, found {len(parsed)} matching rows)."
    )


# --------------------------------------------------------------------------- #
# Browser verification
# --------------------------------------------------------------------------- #
def test_chart_renders_in_browser(serve_output, browser_verifier):
    reason = (
        "The generated chart.html is a self-contained Altair bump chart. When opened in a "
        "browser it must render successfully and draw visible marks."
    )
    truth = (
        f"Navigate to {serve_output}/chart.html. Wait for the visualization to finish loading. "
        "Verify that the page does not show any Vega/Vega-Lite error message and that a chart is "
        "rendered containing visible line marks (connected paths) and point markers colored by "
        "category. Confirm the y axis represents rank with rank 1 near the top of the chart."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_chart_renders_in_browser",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
