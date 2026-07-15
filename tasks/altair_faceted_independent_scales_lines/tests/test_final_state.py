import json
import os
import re
import socket
import subprocess

import pytest
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"
BUILD_SCRIPT = os.path.join(PROJECT_DIR, "build_chart.py")
CHART_HTML = os.path.join(PROJECT_DIR, "chart.html")

# Serve the generated static HTML over IPv4 loopback for the browser check.
HOST = "127.0.0.1"
PORT = 8123
BASE_URL = f"http://{HOST}:{PORT}"
CHART_URL = f"{BASE_URL}/chart.html"


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _extract_spec(html_text):
    """Extract the Vega-Lite JSON spec embedded in an Altair standalone HTML."""
    match = re.search(r"(?:var|let|const)\s+spec\s*=\s*", html_text)
    assert match is not None, (
        "Could not locate the embedded Vega-Lite spec (no `var spec = ...`) in chart.html."
    )
    start = html_text.index("{", match.end())
    depth = 0
    in_string = False
    escape = False
    end = None
    for i in range(start, len(html_text)):
        ch = html_text[i]
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
                end = i + 1
                break
    assert end is not None, "Failed to parse a balanced JSON object for the embedded spec."
    return json.loads(html_text[start:end])


def _walk(node):
    """Yield every dict node in a nested JSON structure."""
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from _walk(value)
    elif isinstance(node, list):
        for item in node:
            yield from _walk(item)


def _collect_marks(node):
    marks = []
    for d in _walk(node):
        if "mark" in d:
            mark = d["mark"]
            if isinstance(mark, str):
                marks.append(mark)
            elif isinstance(mark, dict) and "type" in mark:
                marks.append(mark["type"])
    return marks


def _collect_encoding_fields(node, channel):
    """Collect field names used on a given encoding channel anywhere in the spec."""
    fields = []
    for d in _walk(node):
        enc = d.get("encoding")
        if isinstance(enc, dict) and channel in enc:
            ch = enc[channel]
            if isinstance(ch, dict) and "field" in ch:
                fields.append(ch["field"])
    return fields


def _collect_tooltip_fields(node):
    fields = []
    for d in _walk(node):
        enc = d.get("encoding")
        if isinstance(enc, dict) and "tooltip" in enc:
            tip = enc["tooltip"]
            entries = tip if isinstance(tip, list) else [tip]
            for entry in entries:
                if isinstance(entry, dict) and "field" in entry:
                    fields.append(entry["field"])
    return fields


def _collect_selects(node):
    """Collect all selection definitions (from params) in the spec."""
    selects = []
    for d in _walk(node):
        params = d.get("params")
        if isinstance(params, list):
            for p in params:
                if isinstance(p, dict) and isinstance(p.get("select"), (dict, str)):
                    selects.append(p["select"])
    return selects


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def built_chart():
    """Rebuild chart.html from scratch by running the executor's command."""
    if os.path.exists(CHART_HTML):
        os.remove(CHART_HTML)
    assert os.path.isfile(BUILD_SCRIPT), (
        f"Build script {BUILD_SCRIPT} does not exist; expected `python3 build_chart.py`."
    )
    result = subprocess.run(
        ["python3", "build_chart.py"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"`python3 build_chart.py` failed (exit {result.returncode}).\n"
        f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )
    assert os.path.isfile(CHART_HTML), (
        f"Expected output file {CHART_HTML} was not produced by the build command."
    )
    with open(CHART_HTML, "r", encoding="utf-8") as f:
        html_text = f.read()
    return html_text


@pytest.fixture(scope="session")
def spec(built_chart):
    return _extract_spec(built_chart)


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def serve_chart(built_chart, xprocess):
    class Starter(ProcessStarter):
        name = "serve_chart"
        args = ["python3", "-m", "http.server", str(PORT), "--bind", HOST]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 60
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex((HOST, PORT)) == 0

    info = xprocess.getinfo(Starter.name)
    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        try:
            with open(info.logpath, "r") as f:
                print(f"===== serve_chart log (started={started}) =====")
                print(f.read())
        except OSError:
            pass
    yield BASE_URL
    info.terminate()


# --------------------------------------------------------------------------- #
# File / spec structure checks
# --------------------------------------------------------------------------- #
def test_standalone_html_document(built_chart):
    assert "<html" in built_chart.lower(), "chart.html is not a complete standalone HTML document."
    assert "vegaembed(" in built_chart.lower(), (
        "chart.html does not embed a vegaEmbed(...) call; it is not a self-contained Altair HTML export."
    )


def test_no_remote_data_url(spec):
    for d in _walk(spec):
        url = d.get("url")
        if isinstance(url, str) and url.lower().startswith(("http://", "https://")):
            assert not re.search(r"\.(csv|json|tsv)", url.lower()), (
                f"Spec references a remote data URL ({url}); data must be local/inline."
            )


def test_wrapped_facet_two_columns(spec):
    assert "facet" in spec, (
        "Top-level spec has no `facet` definition; a wrapped single-field facet is required "
        "(a column-only facet will not wrap into a grid)."
    )
    facet_def = spec["facet"]
    facet_fields = []
    for d in _walk(facet_def):
        if isinstance(d, dict) and "field" in d:
            facet_fields.append(d["field"])
    if isinstance(facet_def, dict) and "field" in facet_def:
        facet_fields.append(facet_def["field"])
    assert "series" in facet_fields, (
        f"Facet must be defined on the 'series' field, found facet fields: {facet_fields}"
    )
    assert spec.get("columns") == 2, (
        f"Faceted grid must wrap into exactly 2 columns; found columns={spec.get('columns')!r}."
    )


def test_independent_y_scale(spec):
    resolve = spec.get("resolve", {})
    scale = resolve.get("scale", {}) if isinstance(resolve, dict) else {}
    assert scale.get("y") == "independent", (
        f"Expected resolve.scale.y == 'independent', got {scale.get('y')!r}."
    )


def test_shared_color(spec):
    color_fields = _collect_encoding_fields(spec, "color")
    assert "series" in color_fields, (
        f"Color must be encoded by the 'series' field; found color fields: {color_fields}"
    )
    resolve = spec.get("resolve", {})
    scale = resolve.get("scale", {}) if isinstance(resolve, dict) else {}
    assert scale.get("color") != "independent", (
        "Color scale must remain shared across panels (resolve.scale.color must not be 'independent')."
    )


def test_line_marks(spec):
    marks = _collect_marks(spec)
    assert "line" in marks, f"Expected a line mark in the panel spec; found marks: {marks}"


def test_x_and_y_encodings(spec):
    x_fields = _collect_encoding_fields(spec, "x")
    y_fields = _collect_encoding_fields(spec, "y")
    assert "date" in x_fields, f"Expected x encoding on 'date'; found x fields: {x_fields}"
    assert "value" in y_fields, f"Expected y encoding on 'value'; found y fields: {y_fields}"


def test_shared_hover_tooltip(spec):
    selects = _collect_selects(spec)
    hover_ok = False
    for sel in selects:
        if isinstance(sel, str):
            continue
        if sel.get("type") != "point":
            continue
        nearest = bool(sel.get("nearest"))
        on = str(sel.get("on", "")).lower()
        hover = "pointerover" in on or "mouseover" in on or "pointermove" in on
        if nearest and hover:
            hover_ok = True
            break
    assert hover_ok, (
        f"Expected a shared hover point selection (type 'point', nearest=true, on pointerover/mouseover); "
        f"found selects: {selects}"
    )
    tooltip_fields = _collect_tooltip_fields(spec)
    assert "date" in tooltip_fields and "value" in tooltip_fields, (
        f"Tooltip must include both 'date' and 'value' fields; found tooltip fields: {tooltip_fields}"
    )


# --------------------------------------------------------------------------- #
# Browser render check
# --------------------------------------------------------------------------- #
def test_browser_render(serve_chart, browser_verifier):
    reason = (
        "The generated chart.html should render as a faceted small-multiple line-chart dashboard "
        "using Vega-Embed, with one panel per metric series arranged in a 2-column grid and each "
        "panel using its own independent y-axis."
    )
    truth = (
        f"Navigate to {CHART_URL}. Wait for the Vega-Embed visualization to finish rendering. "
        "Verify that the page displays a grid of four separate line-chart panels (small multiples), "
        "each panel showing a line, and that no error message or blank/failed rendering is shown. "
        "There must be no JavaScript console errors and the charts must be visibly drawn."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_render",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
