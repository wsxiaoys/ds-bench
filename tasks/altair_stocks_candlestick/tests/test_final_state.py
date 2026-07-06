import json
import os
import socket
import subprocess

import pytest
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/altair_stocks_candlestick"
CHART_HTML = os.path.join(PROJECT_DIR, "chart.html")
CHART_JSON = os.path.join(PROJECT_DIR, "chart.json")
BUILD_SCRIPT = os.path.join(PROJECT_DIR, "build_chart.py")
SERVE_PORT = 8765


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize_mark(mark):
    """Vega-Lite marks can be either a string or an object with a 'type' field."""
    if isinstance(mark, str):
        return mark
    if isinstance(mark, dict):
        return mark.get("type")
    return None


def _find_layer_with_mark(layers, mark_type):
    for layer in layers:
        if _normalize_mark(layer.get("mark")) == mark_type:
            return layer
    return None


def _field_of(encoding_entry):
    if not isinstance(encoding_entry, dict):
        return None
    return encoding_entry.get("field")


def _type_of(encoding_entry):
    if not isinstance(encoding_entry, dict):
        return None
    return encoding_entry.get("type")


def _condition_payload(color_encoding):
    """Return the condition dict (or list of dicts) of a color encoding, or None."""
    if not isinstance(color_encoding, dict):
        return None
    return color_encoding.get("condition")


def _condition_references_open_close(condition):
    """Recursively check that a condition mentions both 'open' and 'close'."""
    if condition is None:
        return False
    if isinstance(condition, list):
        return any(_condition_references_open_close(c) for c in condition)
    if isinstance(condition, dict):
        # Most common: {"test": "datum.open <= datum.close", "value": "..."}
        # Or:           {"param": "...", "value": "..."}
        # Or:           {"test": {"field": "open", ...}, ...}
        as_text = json.dumps(condition)
        return ("open" in as_text) and ("close" in as_text)
    if isinstance(condition, str):
        return ("open" in condition) and ("close" in condition)
    return False


# ---------------------------------------------------------------------------
# Build the chart artifacts (Setup from truth)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def build_chart_artifacts():
    """Per `truth`: clean existing artifacts and re-run `python3 build_chart.py`."""
    for artifact in (CHART_HTML, CHART_JSON):
        if os.path.isfile(artifact):
            os.remove(artifact)

    assert os.path.isfile(BUILD_SCRIPT), (
        f"Expected the executor to create {BUILD_SCRIPT}, but it was not found."
    )

    result = subprocess.run(
        ["python3", "build_chart.py"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"`python3 build_chart.py` failed with code {result.returncode}.\n"
        f"stdout:\n{result.stdout}\n"
        f"stderr:\n{result.stderr}"
    )
    yield


# ---------------------------------------------------------------------------
# 1. Artifacts exist
# ---------------------------------------------------------------------------

def test_chart_html_exists():
    assert os.path.isfile(CHART_HTML), (
        f"Expected {CHART_HTML} to exist after running build_chart.py."
    )


def test_chart_json_exists():
    assert os.path.isfile(CHART_JSON), (
        f"Expected {CHART_JSON} to exist after running build_chart.py."
    )


# ---------------------------------------------------------------------------
# 2. Spec shape (`chart.json`)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def spec():
    with open(CHART_JSON, "r") as f:
        return json.load(f)


def test_spec_is_vconcat_with_two_views(spec):
    assert "vconcat" in spec, (
        "Top-level spec must use `vconcat`. Found keys: " + str(list(spec.keys()))
    )
    assert isinstance(spec["vconcat"], list) and len(spec["vconcat"]) == 2, (
        "`vconcat` must contain exactly two child views (upper candlestick, "
        f"lower volume). Got: {spec.get('vconcat')!r}"
    )


def test_upper_view_is_layered_rule_and_bar(spec):
    upper = spec["vconcat"][0]
    assert "layer" in upper and isinstance(upper["layer"], list), (
        "Upper (candlestick) view must be a layered chart with a `layer` array. "
        f"Got: {upper!r}"
    )

    rule_layer = _find_layer_with_mark(upper["layer"], "rule")
    bar_layer = _find_layer_with_mark(upper["layer"], "bar")

    assert rule_layer is not None, (
        "Upper view must include a `rule` layer (high-low wick). "
        f"Layers found: {[_normalize_mark(l.get('mark')) for l in upper['layer']]}"
    )
    assert bar_layer is not None, (
        "Upper view must include a `bar` layer (open-close body). "
        f"Layers found: {[_normalize_mark(l.get('mark')) for l in upper['layer']]}"
    )


def test_rule_layer_uses_low_and_high(spec):
    upper = spec["vconcat"][0]
    rule_layer = _find_layer_with_mark(upper["layer"], "rule")
    assert rule_layer is not None, "Missing rule layer in upper view."
    enc = rule_layer.get("encoding", {})
    # `y` and `y2` may be defined locally on the rule layer or shared on the upper base.
    base_enc = upper.get("encoding", {})

    y_field = _field_of(enc.get("y")) or _field_of(base_enc.get("y"))
    y2_field = _field_of(enc.get("y2")) or _field_of(base_enc.get("y2"))

    assert y_field == "low", (
        f"Rule layer must encode y from field 'low'. Got y.field={y_field!r}."
    )
    assert y2_field == "high", (
        f"Rule layer must encode y2 from field 'high'. Got y2.field={y2_field!r}."
    )


def test_bar_layer_uses_open_and_close(spec):
    upper = spec["vconcat"][0]
    bar_layer = _find_layer_with_mark(upper["layer"], "bar")
    assert bar_layer is not None, "Missing bar layer in upper view."
    enc = bar_layer.get("encoding", {})
    base_enc = upper.get("encoding", {})

    y_field = _field_of(enc.get("y")) or _field_of(base_enc.get("y"))
    y2_field = _field_of(enc.get("y2")) or _field_of(base_enc.get("y2"))

    assert y_field == "open", (
        f"Bar layer must encode y from field 'open'. Got y.field={y_field!r}."
    )
    assert y2_field == "close", (
        f"Bar layer must encode y2 from field 'close'. Got y2.field={y2_field!r}."
    )


def test_color_encoding_uses_conditional_on_open_close(spec):
    upper = spec["vconcat"][0]
    base_enc = upper.get("encoding", {})
    candidate_color_encodings = []

    # Color may live on the upper base, or on individual layers.
    if "color" in base_enc:
        candidate_color_encodings.append(base_enc["color"])
    for layer in upper["layer"]:
        layer_enc = layer.get("encoding", {})
        if "color" in layer_enc:
            candidate_color_encodings.append(layer_enc["color"])

    assert candidate_color_encodings, (
        "Upper view must have a `color` encoding (on the base or one of the layers)."
    )

    matched = False
    for color_enc in candidate_color_encodings:
        condition = _condition_payload(color_enc)
        if _condition_references_open_close(condition):
            matched = True
            break

    assert matched, (
        "At least one `color` encoding in the upper view must use a `condition` "
        "that references both `open` and `close` (e.g. via a predicate string "
        "like `datum.open <= datum.close`). "
        f"Found color encodings: {json.dumps(candidate_color_encodings)}"
    )


def test_lower_view_is_volume_bar(spec):
    lower = spec["vconcat"][1]
    assert _normalize_mark(lower.get("mark")) == "bar", (
        f"Lower view must use a `bar` mark. Got mark={lower.get('mark')!r}."
    )
    enc = lower.get("encoding", {})

    y_field = _field_of(enc.get("y"))
    assert y_field == "volume", (
        f"Lower view must encode y from field 'volume'. Got y.field={y_field!r}."
    )

    x_field = _field_of(enc.get("x"))
    x_type = _type_of(enc.get("x"))
    assert x_field == "date", (
        f"Lower view must encode x from field 'date'. Got x.field={x_field!r}."
    )
    assert x_type == "temporal", (
        f"Lower view's x encoding must be of type 'temporal'. Got x.type={x_type!r}."
    )


def _interval_param_in(view):
    """Return (name, param_dict) of an interval selection parameter on `view`, if any."""
    for param in view.get("params", []) or []:
        select = param.get("select")
        if isinstance(select, str) and select == "interval":
            return param.get("name"), param
        if isinstance(select, dict) and select.get("type") == "interval":
            return param.get("name"), param
    return None, None


def _find_interval_brush(spec):
    """
    Robustly find interval selection in a Vega-Lite spec,
    regardless of whether it is hoisted to top-level or
    attached to a sub-view (e.g. vconcat layers).
    """
    candidates = []

    # 1. top-level params
    if isinstance(spec.get("params"), list):
        candidates.extend(spec["params"])

    # 2. vconcat children params
    for child in spec.get("vconcat", []):
        if isinstance(child, dict) and isinstance(child.get("params"), list):
            candidates.extend(child["params"])

    # 3. search interval selection
    for p in candidates:
        if not isinstance(p, dict):
            continue
        sel = p.get("select")
        if isinstance(sel, dict) and sel.get("type") == "interval":
            return p.get("name"), p

    return None, None

def test_lower_view_has_interval_brush_on_x(spec):
    name, brush = _find_interval_brush(spec)

    assert brush is not None, (
        "Expected an interval selection brush defined in the chart (either "
        "top-level or in lower view params)."
    )

    select = brush["select"]

    assert isinstance(select, dict), (
        "Interval selection must be defined as an object (not shorthand)."
    )

    encodings = select.get("encodings")
    assert encodings == ["x"], (
        "Interval selection must constrain brush to x encoding only. "
        f"Got encodings={encodings!r}."
    )


def test_upper_x_scale_domain_references_brush(spec):
    upper = spec["vconcat"][0]

    brush_name, _ = _find_interval_brush(spec)
    assert brush_name, "Could not find interval brush in chart spec."

    candidate_x_encodings = []

    # upper main encoding
    base_enc = upper.get("encoding", {})
    if isinstance(base_enc, dict) and "x" in base_enc:
        candidate_x_encodings.append(base_enc["x"])

    # layered encoding support
    for layer in upper.get("layer", []):
        layer_enc = layer.get("encoding", {})
        if isinstance(layer_enc, dict) and "x" in layer_enc:
            candidate_x_encodings.append(layer_enc["x"])

    assert candidate_x_encodings, "Upper view has no x encoding."

    matched = False

    for x_enc in candidate_x_encodings:
        if not isinstance(x_enc, dict):
            continue

        scale = x_enc.get("scale")
        if not isinstance(scale, dict):
            continue

        domain = scale.get("domain")

        # case 1: single param reference
        if isinstance(domain, dict) and domain.get("param") == brush_name:
            matched = True
            break

        # case 2: extended form (defensive)
        if isinstance(domain, dict):
            if domain.get("param") == brush_name:
                matched = True
                break

        # case 3: list form (defensive)
        if isinstance(domain, list):
            for d in domain:
                if isinstance(d, dict) and d.get("param") == brush_name:
                    matched = True
                    break

    assert matched, (
        "Upper view x-scale domain must reference the interval brush. "
        f"Expected param={brush_name}. "
        f"Got encodings={json.dumps(candidate_x_encodings)}"
    )

# ---------------------------------------------------------------------------
# 3 & 4. Browser verification
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def serve_chart(xprocess):
    class Starter(ProcessStarter):
        name = "serve_chart"
        args = ["python3", "-m", "http.server", str(SERVE_PORT)]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 60
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", SERVE_PORT)) == 0

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0  # track how many lines have already been printed

    def capture_logs(tag):
        nonlocal printed_log_lines
        with open(info.logpath, "r") as f:
            all_lines = f.readlines()
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"============================== [{tag}: End  ] Captured {Starter.name} logfile ==============================")

    started = False
    try:
        # ensure() starts the process and blocks until startup_check is True
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield f"http://localhost:{SERVE_PORT}/chart.html"
    capture_logs("TEARDOWN")
    info.terminate()


def test_chart_renders_candlestick_and_volume_in_browser(serve_chart):
    reason = (
        "The HTML chart must render an interactive candlestick + volume composition. "
        "The upper panel shows per-day candlesticks (vertical wicks plus open/close "
        "bodies, colored differently for up vs down days). The lower panel shows a "
        "volume bar chart that hosts an x-axis interval brush controlling the upper "
        "panel's x-axis domain."
    )
    truth = (
        f"Navigate to {serve_chart}. Wait for the Vega-Lite visualization to render. "
        "Verify there are no JavaScript errors and the page successfully loads "
        "vega-embed. Confirm there are TWO stacked plot regions: (a) an UPPER "
        "candlestick chart where each x-position has a thin vertical wick (a rule "
        "from low to high) overlaid with a thicker open-close bar body, and (b) a "
        "LOWER bar chart of trading volume positioned beneath it sharing the same "
        "date x-axis. Bullish (up) candles and bearish (down) candles must be drawn "
        "in two visibly different colors. The lower volume chart's plot area must "
        "be interactive (an interval brush can be dragged across its x-axis)."
    )

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_chart_renders_candlestick_and_volume_in_browser",
    )
    assert result.status == "pass", (
        f"Browser verification failed: {getattr(result, 'reason', result)!r}"
    )
