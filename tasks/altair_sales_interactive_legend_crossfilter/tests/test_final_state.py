import csv
import json
import os
import re
import socket

import pytest
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"
DASHBOARD_HTML = os.path.join(PROJECT_DIR, "dashboard.html")
DATA_FILE = os.path.join(PROJECT_DIR, "data", "sales.csv")

HOST = "127.0.0.1"
PORT = 8123
BASE_URL = f"http://{HOST}:{PORT}"
DASHBOARD_URL = f"{BASE_URL}/dashboard.html"


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _read_html():
    assert os.path.isfile(DASHBOARD_HTML), f"Output file {DASHBOARD_HTML} does not exist."
    with open(DASHBOARD_HTML, encoding="utf-8") as f:
        return f.read()


def _brace_match(html, brace_start):
    """Return the balanced {...} substring starting at brace_start, or None."""
    depth = 0
    in_str = False
    esc = False
    for i in range(brace_start, len(html)):
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
                    return html[brace_start : i + 1]
    return None


def _is_vega_lite_spec(obj):
    if not isinstance(obj, dict):
        return False
    schema = obj.get("$schema", "")
    if isinstance(schema, str) and "vega-lite" in schema:
        return True
    return any(
        k in obj for k in ("mark", "layer", "vconcat", "hconcat", "concat", "facet", "repeat")
    )


def _extract_vega_spec(html):
    """Extract the embedded Vega-Lite JSON spec from an Altair-generated HTML file.

    Altair emits `const spec = {...};` in the trailing user script. We scan every
    JS object-literal declaration, keep those that parse as JSON and look like a
    Vega-Lite spec, and return the last one (the runtime bundle appears first).
    """
    candidates = []
    for m in re.finditer(r"(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*\{", html):
        brace_start = m.end() - 1
        blob = _brace_match(html, brace_start)
        if blob is None:
            continue
        try:
            data = json.loads(blob)
        except ValueError:
            continue
        if _is_vega_lite_spec(data):
            candidates.append(data)
    assert candidates, "No embedded Vega-Lite spec object was found in the HTML."
    return candidates[-1]


def _walk(obj):
    """Yield every dict found anywhere inside a nested JSON structure."""
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from _walk(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _walk(v)


def _find_key(obj, key):
    """Yield every value stored under `key` anywhere in the structure."""
    for d in _walk(obj):
        if key in d:
            yield d[key]


def _unit_views(spec):
    """Return all unit-view dicts (dicts that carry a 'mark')."""
    return [d for d in _walk(spec) if "mark" in d]


def _mark_type(unit):
    mark = unit.get("mark")
    if isinstance(mark, str):
        return mark
    if isinstance(mark, dict):
        return mark.get("type")
    return None


def _collect_data_rows(spec):
    """Collect all inline data rows from top-level datasets and inline 'values'."""
    rows = []
    datasets = spec.get("datasets")
    if isinstance(datasets, dict):
        for v in datasets.values():
            if isinstance(v, list):
                rows.extend(r for r in v if isinstance(r, dict))
    for values in _find_key(spec, "values"):
        if isinstance(values, list):
            rows.extend(r for r in values if isinstance(r, dict))
    return rows


def _read_csv_rows():
    with open(DATA_FILE, newline="") as f:
        return list(csv.DictReader(f))


@pytest.fixture(scope="module")
def html():
    return _read_html()


@pytest.fixture(scope="module")
def spec(html):
    return _extract_vega_spec(html)


@pytest.fixture(scope="module")
def selection_param(spec):
    """Locate the point selection parameter bound to the legend on `category`."""
    for params in _find_key(spec, "params"):
        if not isinstance(params, list):
            continue
        for p in params:
            if not isinstance(p, dict):
                continue
            if p.get("bind") != "legend":
                continue
            select = p.get("select")
            fields = None
            sel_type = None
            if isinstance(select, dict):
                sel_type = select.get("type")
                fields = select.get("fields")
            elif isinstance(select, str):
                sel_type = select
            if sel_type == "point" and fields and "category" in fields:
                return p
    return None


# --------------------------------------------------------------------------- #
# 1. Artifact exists
# --------------------------------------------------------------------------- #
def test_dashboard_html_exists(html):
    assert html.strip(), f"{DASHBOARD_HTML} exists but is empty."


# --------------------------------------------------------------------------- #
# 2. Self-contained & offline
# --------------------------------------------------------------------------- #
def test_self_contained_and_offline(html, spec):
    assert "vegaEmbed" in html or "vega-embed" in html, (
        "The HTML does not appear to use vegaEmbed to render the chart."
    )
    # No external <script src="http..."> runtime references => runtime is inlined.
    external_scripts = re.findall(
        r'<script[^>]+src\s*=\s*["\']https?://', html, flags=re.IGNORECASE
    )
    assert not external_scripts, (
        "The HTML loads its JavaScript runtime from an external URL "
        f"(found: {external_scripts}); it must embed the runtime inline for offline use."
    )
    # Data must be inline, not fetched from a URL / local CSV.
    assert "sales.csv" not in html, (
        "The HTML references the local CSV path 'sales.csv'; data must be embedded inline."
    )
    for data_val in _find_key(spec, "data"):
        if isinstance(data_val, dict) and "url" in data_val:
            pytest.fail(
                f"A data source uses a URL ({data_val['url']}); data must be embedded inline."
            )


# --------------------------------------------------------------------------- #
# 3. Two linked views (vconcat with a bar mark and a line mark)
# --------------------------------------------------------------------------- #
def test_two_linked_views(spec):
    vconcat_found = any(True for _ in _find_key(spec, "vconcat"))
    assert vconcat_found, "The spec does not compose views via vertical concatenation (vconcat)."

    mark_types = {_mark_type(u) for u in _unit_views(spec)}
    assert "bar" in mark_types, f"No bar view found. Marks present: {sorted(m for m in mark_types if m)}."
    assert "line" in mark_types, f"No line view found. Marks present: {sorted(m for m in mark_types if m)}."


# --------------------------------------------------------------------------- #
# 4. Interactive legend selection
# --------------------------------------------------------------------------- #
def test_interactive_legend_selection(selection_param):
    assert selection_param is not None, (
        "No point selection parameter bound to the legend (bind='legend') "
        "and projected on the 'category' field was found."
    )


def test_selection_referenced_by_both_views(spec, selection_param):
    assert selection_param is not None, "Selection parameter missing (see previous test)."
    name = selection_param.get("name")
    assert name, "The selection parameter has no name."

    units = _unit_views(spec)
    bar_units = [u for u in units if _mark_type(u) == "bar"]
    line_units = [u for u in units if _mark_type(u) == "line"]
    assert bar_units, "No bar view present to reference the selection."
    assert line_units, "No line view present to reference the selection."

    bar_refs = any(name in json.dumps(u.get("encoding", {})) for u in bar_units)
    line_refs = any(name in json.dumps(u.get("transform", [])) for u in line_units)
    assert bar_refs, f"The bar view does not reference the selection parameter '{name}'."
    assert line_refs, f"The line view does not reference the selection parameter '{name}'."


# --------------------------------------------------------------------------- #
# 5. Conditional opacity on the bar view
# --------------------------------------------------------------------------- #
def test_conditional_opacity_on_bar_view(spec, selection_param):
    assert selection_param is not None, "Selection parameter missing (see previous test)."
    name = selection_param.get("name")
    bar_units = [u for u in _unit_views(spec) if _mark_type(u) == "bar"]
    assert bar_units, "No bar view present."

    ok = False
    for u in bar_units:
        opacity = u.get("encoding", {}).get("opacity")
        if not isinstance(opacity, dict):
            continue
        if "condition" not in opacity:
            continue
        if name in json.dumps(opacity):
            ok = True
            break
    assert ok, (
        "The bar view must have a conditional 'opacity' encoding that references "
        f"the legend selection '{name}' (so selected bars are more opaque than others)."
    )


# --------------------------------------------------------------------------- #
# 6. Filter transform on the line view
# --------------------------------------------------------------------------- #
def test_filter_transform_on_line_view(spec, selection_param):
    assert selection_param is not None, "Selection parameter missing (see previous test)."
    name = selection_param.get("name")
    line_units = [u for u in _unit_views(spec) if _mark_type(u) == "line"]
    assert line_units, "No line view present."

    ok = False
    for u in line_units:
        transforms = u.get("transform", [])
        if not isinstance(transforms, list):
            continue
        for t in transforms:
            if isinstance(t, dict) and "filter" in t and name in json.dumps(t):
                ok = True
                break
        if ok:
            break
    assert ok, (
        "The line view must carry a 'filter' transform whose predicate references "
        f"the legend selection '{name}'."
    )


# --------------------------------------------------------------------------- #
# 7. Data integrity: inline data matches the CSV
# --------------------------------------------------------------------------- #
def test_inline_data_matches_csv(spec):
    csv_rows = _read_csv_rows()
    assert csv_rows, f"{DATA_FILE} contains no rows."

    expected = {}
    expected_categories = set()
    for r in csv_rows:
        date = (r["date"] or "").strip()[:10]
        cat = (r["category"] or "").strip()
        sales = int(float(r["sales"]))
        expected[(date, cat)] = sales
        expected_categories.add(cat)

    rows = _collect_data_rows(spec)
    assert rows, "No inline data rows were found embedded in the spec."

    actual = {}
    actual_categories = set()
    for r in rows:
        if "date" not in r or "category" not in r or "sales" not in r:
            continue
        date = str(r["date"])[:10]
        cat = str(r["category"])
        try:
            sales = int(round(float(r["sales"])))
        except (TypeError, ValueError):
            continue
        actual[(date, cat)] = sales
        actual_categories.add(cat)

    missing_categories = expected_categories - actual_categories
    assert not missing_categories, (
        f"Categories present in the CSV are missing from the embedded data: {sorted(missing_categories)}."
    )

    mismatches = []
    for key, sales in expected.items():
        if key not in actual:
            mismatches.append(f"missing {key}")
        elif actual[key] != sales:
            mismatches.append(f"{key}: expected {sales}, got {actual[key]}")
    assert not mismatches, (
        "Embedded data does not match the source CSV: " + "; ".join(mismatches[:10])
    )


# --------------------------------------------------------------------------- #
# 8. Browser rendering (pochi-verifier)
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def serve_dashboard(xprocess):
    """Serve the project directory over a local static HTTP server."""

    class Starter(ProcessStarter):
        name = "serve_dashboard"
        # Serve over IPv4 loopback explicitly to avoid ::1 resolution issues.
        args = ["python3", "-m", "http.server", str(PORT), "--bind", HOST]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 60
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex((HOST, PORT)) == 0

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        with open(info.logpath, "r") as f:
            lines = f.readlines()
        new = lines[printed:]
        printed = len(lines)
        print(f"===== [{tag}] {Starter.name} log =====")
        print("".join(new))

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def test_dashboard_renders_in_browser(serve_dashboard, browser_verifier):
    reason = (
        "The saved HTML dashboard should render a Vega-Altair visualization fully offline. "
        "It contains two stacked views (a stacked bar chart and a time-series line chart) "
        "that share a single clickable color legend for product categories."
    )
    truth = (
        f"Navigate to {DASHBOARD_URL}. Verify that the page renders a chart without any "
        "JavaScript errors in the browser console. Verify that at least one SVG or canvas "
        "element is drawn inside the visualization container (the chart is actually rendered, "
        "not blank). Verify that a color legend listing product category names is visible on "
        "the page. Confirm that the visualization renders using only content embedded in the "
        "page (no external network host is required)."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_dashboard_renders_in_browser",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
