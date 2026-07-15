import json
import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/altair-task"
BUILD_SCRIPT = "build_chart.py"
OUTPUT_HTML = os.path.join(PROJECT_DIR, "output", "chart.html")


def _extract_balanced_object(text, start_brace_index):
    """Return the JSON object substring starting at the given '{' index,
    walking forward while respecting string literals and escapes."""
    depth = 0
    in_string = False
    escape = False
    for i in range(start_brace_index, len(text)):
        ch = text[i]
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
                return text[start_brace_index : i + 1]
    raise ValueError("Unbalanced braces while extracting spec object.")


def _extract_spec(html_text):
    """Locate the embedded Vega-Lite `spec` object in the Altair HTML output."""
    match = re.search(r"(?:var|let|const)\s+spec\s*=\s*", html_text)
    assert match is not None, (
        "Could not find an embedded `spec` assignment in the HTML output; "
        "the file does not look like a standalone Altair/vegaEmbed HTML document."
    )
    brace_index = html_text.find("{", match.end())
    assert brace_index != -1, "No JSON object found after the `spec =` assignment."
    raw = _extract_balanced_object(html_text, brace_index)
    return json.loads(raw)


def _iter_dicts(obj):
    """Yield every dict nested anywhere inside obj."""
    if isinstance(obj, dict):
        yield obj
        for v in obj.values():
            yield from _iter_dicts(v)
    elif isinstance(obj, list):
        for item in obj:
            yield from _iter_dicts(item)


def _mark_type(layer):
    mark = layer.get("mark")
    if isinstance(mark, str):
        return mark
    if isinstance(mark, dict):
        return mark.get("type")
    return None


def _mark_dict(layer):
    mark = layer.get("mark")
    return mark if isinstance(mark, dict) else {}


def _field(enc_channel):
    if isinstance(enc_channel, dict):
        return enc_channel.get("field")
    return None


def _aggregate(enc_channel):
    if isinstance(enc_channel, dict):
        return enc_channel.get("aggregate")
    return None


def _collect_inline_group_values(spec):
    """Gather all 'group' values embedded inline in the spec's data."""
    groups = set()

    def scan_values(values):
        if isinstance(values, list):
            for row in values:
                if isinstance(row, dict) and "group" in row:
                    groups.add(row["group"])

    # Top-level datasets: {"datasets": {"name": [ {...}, ... ]}}
    datasets = spec.get("datasets")
    if isinstance(datasets, dict):
        for values in datasets.values():
            scan_values(values)

    # Any inline data.values anywhere in the spec.
    for d in _iter_dicts(spec):
        data = d.get("data")
        if isinstance(data, dict):
            scan_values(data.get("values"))

    return groups


@pytest.fixture(scope="session")
def built_spec():
    # Setup: remove any previous output so the check reflects a fresh run.
    if os.path.isfile(OUTPUT_HTML):
        os.remove(OUTPUT_HTML)

    result = subprocess.run(
        ["python3", BUILD_SCRIPT],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=300,
    )
    print("STDOUT:\n", result.stdout)
    print("STDERR:\n", result.stderr)
    assert result.returncode == 0, (
        f"`python3 {BUILD_SCRIPT}` failed with exit code {result.returncode}. "
        f"stderr: {result.stderr}"
    )
    assert os.path.isfile(
        OUTPUT_HTML
    ), f"Expected the build to create {OUTPUT_HTML}, but it does not exist."

    with open(OUTPUT_HTML, encoding="utf-8") as f:
        html_text = f.read()
    assert html_text.strip(), "The generated HTML file is empty."
    assert (
        "vegaEmbed" in html_text or "vega-embed" in html_text
    ), "The HTML output does not appear to embed a Vega-Lite chart (no vegaEmbed reference)."

    return _extract_spec(html_text)


def test_html_output_exists_and_is_self_contained(built_spec):
    # If the fixture produced a spec, the HTML exists, is non-empty, and embeds vegaEmbed.
    assert isinstance(built_spec, dict), "Extracted spec is not a JSON object."


def test_no_remote_data_url(built_spec):
    for d in _iter_dicts(built_spec):
        url = d.get("url")
        if isinstance(url, str):
            assert not re.match(
                r"^https?://", url.strip(), flags=re.IGNORECASE
            ), f"Spec references a remote data URL ({url}); data must be embedded inline."


def test_layered_chart_with_three_layers(built_spec):
    layers = built_spec.get("layer")
    assert isinstance(
        layers, list
    ), "Top-level spec does not contain a 'layer' array; the chart must be layered."
    assert (
        len(layers) >= 3
    ), f"Expected at least 3 layers (raw points, mean, error bar), found {len(layers)}."


def test_error_bar_ci_layer(built_spec):
    layers = built_spec.get("layer", [])

    def is_ci_layer(layer):
        # Option 1: an errorbar mark with extent == "ci".
        if _mark_type(layer) == "errorbar":
            extent = _mark_dict(layer).get("extent")
            if extent == "ci":
                return True
            # errorbar defaults aside, also accept explicit ci via encoding below.
        # Option 2: y/y2 encodings using ci0 and ci1 aggregates.
        enc = layer.get("encoding", {})
        aggregates = {
            _aggregate(enc.get("y")),
            _aggregate(enc.get("y2")),
        }
        if "ci0" in aggregates and "ci1" in aggregates:
            return True
        return False

    matches = [layer for layer in layers if is_ci_layer(layer)]
    assert len(matches) >= 1, (
        "No layer represents the 95% confidence interval of the mean. Expected either an "
        "errorbar mark with extent='ci', or y/y2 encodings using the ci0 and ci1 aggregates."
    )


def test_mean_point_layer(built_spec):
    layers = built_spec.get("layer", [])

    def is_mean_point(layer):
        if _mark_type(layer) != "point":
            return False
        enc = layer.get("encoding", {})
        return _aggregate(enc.get("y")) == "mean" and _field(enc.get("y")) == "response"

    matches = [layer for layer in layers if is_mean_point(layer)]
    assert len(matches) >= 1, (
        "No layer draws the group mean as a 'point' mark whose y encoding uses the "
        "mean aggregate on the 'response' field."
    )


def test_raw_jittered_layer(built_spec):
    layers = built_spec.get("layer", [])

    def is_raw_jitter(layer):
        enc = layer.get("encoding", {})
        if "xOffset" not in enc:
            return False
        y = enc.get("y")
        if _field(y) != "response":
            return False
        # Raw observations: the y encoding must NOT be aggregated.
        return _aggregate(y) is None

    matches = [layer for layer in layers if is_raw_jitter(layer)]
    assert len(matches) >= 1, (
        "No layer plots individual (non-aggregated) 'response' observations with a "
        "horizontal jitter via an 'xOffset' encoding."
    )


def test_grouping_across_four_groups(built_spec):
    layers = built_spec.get("layer", [])
    x_fields = set()
    for layer in layers:
        enc = layer.get("encoding", {})
        field = _field(enc.get("x"))
        if field:
            x_fields.add(field)
    assert "group" in x_fields, (
        f"Expected the layers' x encoding to reference the 'group' field, found: {x_fields}."
    )

    groups = _collect_inline_group_values(built_spec)
    for expected in ("A", "B", "C", "D"):
        assert expected in groups, (
            f"Expected group '{expected}' in the embedded inline data, found: {sorted(groups)}."
        )
