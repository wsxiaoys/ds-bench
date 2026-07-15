import json
import os
import subprocess

import pytest

PROJECT_DIR = "/home/user/project"
HTML_PATH = os.path.join(PROJECT_DIR, "heatmap.html")
BUILD_CMD = ["python3", "build_heatmap.py"]


def _run_build():
    """Remove any existing artifact and (re)run the build command."""
    if os.path.exists(HTML_PATH):
        os.remove(HTML_PATH)
    result = subprocess.run(
        BUILD_CMD,
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    return result


def _extract_spec(html):
    """Extract and parse the embedded Vega-Lite spec JSON from an Altair HTML file.

    Altair's ``Chart.save('*.html')`` embeds the spec as a JavaScript assignment
    such as ``var spec = {...};``. We locate the ``spec`` assignment and
    brace-match the following JSON object so the extraction is robust to the
    exact template (var/const/let) and to nested braces inside the JSON.
    """
    import re

    match = re.search(r"\b(?:var|const|let)\s+spec\s*=\s*\{", html)
    assert match is not None, (
        "Could not find an embedded Vega-Lite `spec` assignment in the saved HTML. "
        "The chart may not have been saved with Altair's HTML export."
    )
    start = html.index("{", match.start())

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
                end = i + 1
                break
    assert end is not None, "Failed to brace-match the embedded Vega-Lite spec JSON."
    raw = html[start:end]
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:  # noqa: BLE001
        raise AssertionError(f"Embedded Vega-Lite spec is not valid JSON: {exc}")


def _mark_type(mark):
    if isinstance(mark, str):
        return mark
    if isinstance(mark, dict):
        return mark.get("type")
    return None


def _channel_title(channel):
    """Return the channel/axis title if present (Vega-Lite allows both places)."""
    if not isinstance(channel, dict):
        return None
    if channel.get("title"):
        return channel["title"]
    axis = channel.get("axis")
    if isinstance(axis, dict) and axis.get("title"):
        return axis["title"]
    return None


@pytest.fixture(scope="session")
def spec():
    result = _run_build()
    assert result.returncode == 0, (
        f"Build command {' '.join(BUILD_CMD)} failed with exit code "
        f"{result.returncode}.\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert os.path.isfile(HTML_PATH), f"Expected output file {HTML_PATH} to exist after build."
    assert os.path.getsize(HTML_PATH) > 0, f"Output file {HTML_PATH} is empty."
    with open(HTML_PATH, "r", encoding="utf-8") as f:
        html = f.read()
    return _extract_spec(html)


@pytest.fixture(scope="session")
def layers(spec):
    assert isinstance(spec.get("layer"), list), (
        "Expected the Vega-Lite spec to be a layered spec with a top-level `layer` array."
    )
    assert len(spec["layer"]) == 2, (
        f"Expected exactly 2 layers (rect heatmap + text overlay), got {len(spec['layer'])}."
    )
    return spec["layer"]


@pytest.fixture(scope="session")
def rect_layer(layers):
    matches = [ly for ly in layers if _mark_type(ly.get("mark")) == "rect"]
    assert len(matches) == 1, (
        f"Expected exactly one layer with a `rect` mark, found {len(matches)}."
    )
    return matches[0]


@pytest.fixture(scope="session")
def text_layer(layers):
    matches = [ly for ly in layers if _mark_type(ly.get("mark")) == "text"]
    assert len(matches) == 1, (
        f"Expected exactly one layer with a `text` mark, found {len(matches)}."
    )
    return matches[0]


def test_html_artifact_exists():
    result = _run_build()
    assert result.returncode == 0, (
        f"Build command failed:\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert os.path.isfile(HTML_PATH), f"Expected {HTML_PATH} to exist."
    assert os.path.getsize(HTML_PATH) > 0, f"{HTML_PATH} is empty."


def test_data_is_inline_no_network(spec):
    """The chart data must be embedded inline; no remote data `url` anywhere."""

    def walk(obj):
        if isinstance(obj, dict):
            if "data" in obj and isinstance(obj["data"], dict):
                assert "url" not in obj["data"], (
                    "A `data.url` was found in the spec; the data must be inline "
                    "(no remote dataset URL / network access allowed)."
                )
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for v in obj:
                walk(v)

    walk(spec)

    # Locate the inline row values. Altair can embed data either directly as
    # `data.values` (inline) or via a named dataset: `data: {name: ...}` whose
    # rows live in the top-level `datasets` map. Both are fully local (no URL).
    candidates = []

    datasets = spec.get("datasets")
    if isinstance(datasets, dict):
        for arr in datasets.values():
            if isinstance(arr, list):
                candidates.append(arr)

    def collect_values(obj):
        if isinstance(obj, dict):
            if isinstance(obj.get("values"), list):
                candidates.append(obj["values"])
            for v in obj.values():
                collect_values(v)
        elif isinstance(obj, list):
            for v in obj:
                collect_values(v)

    collect_values(spec)

    values = None
    for arr in candidates:
        if arr and isinstance(arr[0], dict):
            values = arr
            break
    assert values, "Expected inline data (a non-empty array of row objects) embedded in the spec."
    first = values[0]
    assert isinstance(first, dict), "Inline data rows must be objects."
    for col in ("hour", "day", "delay"):
        assert col in first, f"Inline data rows must contain the `{col}` field; got keys {list(first.keys())}."


def test_rect_layer_x_is_binned_hour(rect_layer):
    enc = rect_layer.get("encoding", {})
    x = enc.get("x", {})
    assert x.get("field") == "hour", f"Rect layer x channel must encode field `hour`, got {x.get('field')!r}."
    assert x.get("bin"), "Rect layer x channel must have binning enabled (`bin`)."


def test_rect_layer_y_is_day(rect_layer):
    enc = rect_layer.get("encoding", {})
    y = enc.get("y", {})
    assert y.get("field") == "day", f"Rect layer y channel must encode field `day`, got {y.get('field')!r}."


def test_rect_layer_color_is_mean_delay_with_scheme(rect_layer):
    enc = rect_layer.get("encoding", {})
    color = enc.get("color", {})
    assert color.get("field") == "delay", (
        f"Rect layer color channel must encode field `delay`, got {color.get('field')!r}."
    )
    assert color.get("aggregate") == "mean", (
        f"Rect layer color channel must aggregate with `mean`, got {color.get('aggregate')!r}."
    )
    scale = color.get("scale", {})
    assert isinstance(scale, dict) and scale.get("scheme"), (
        "Rect layer color channel must define a non-empty named color `scheme` on its scale."
    )


def test_text_layer_is_mean_delay(text_layer):
    enc = text_layer.get("encoding", {})
    text = enc.get("text", {})
    assert text.get("field") == "delay", (
        f"Text layer text channel must encode field `delay`, got {text.get('field')!r}."
    )
    assert text.get("aggregate") == "mean", (
        f"Text layer text channel must aggregate `delay` with `mean`, got {text.get('aggregate')!r}."
    )


def test_axis_titles_present(rect_layer):
    enc = rect_layer.get("encoding", {})
    x_title = _channel_title(enc.get("x", {}))
    y_title = _channel_title(enc.get("y", {}))
    assert x_title, "The x axis must have a non-empty title."
    assert y_title, "The y axis must have a non-empty title."


def test_build_is_rerunnable():
    """Re-running the build command must succeed and re-produce a valid HTML file."""
    result = _run_build()
    assert result.returncode == 0, (
        f"Re-running the build command failed:\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert os.path.isfile(HTML_PATH), f"Expected {HTML_PATH} to be regenerated."
    assert os.path.getsize(HTML_PATH) > 0, f"Regenerated {HTML_PATH} is empty."
