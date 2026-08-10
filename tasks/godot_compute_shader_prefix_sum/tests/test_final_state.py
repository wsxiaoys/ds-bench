import glob
import json
import os
import subprocess

import pytest

PROJECT_DIR = "/home/user/scan"
INPUT_FILE = os.path.join(PROJECT_DIR, "data", "input.txt")
OUTPUT_FILE = os.path.join(PROJECT_DIR, "output", "result.json")
RUN_TIMEOUT = 300


def _read_input():
    with open(INPUT_FILE) as f:
        tokens = f.read().split()
    n = int(tokens[0])
    values = [int(t) for t in tokens[1 : 1 + n]]
    assert len(values) == n, (
        f"Input fixture declares {n} values but only {len(values)} were parsed."
    )
    return n, values


def _expected(values):
    total = sum(values)
    prefix = [0] * len(values)
    acc = 0
    for i, v in enumerate(values):
        prefix[i] = acc
        acc += v
    return total, prefix


def _run_godot():
    result = subprocess.run(
        ["godot-run"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=RUN_TIMEOUT,
    )
    print("=== godot-run output (begin) ===")
    print(result.stdout)
    print("=== godot-run output (end) ===")
    return result


def _run_and_load():
    if os.path.exists(OUTPUT_FILE):
        os.remove(OUTPUT_FILE)
    result = _run_godot()
    assert os.path.isfile(OUTPUT_FILE), (
        f"Expected output file {OUTPUT_FILE} was not produced by 'godot-run'. "
        f"Engine output:\n{result.stdout}"
    )
    with open(OUTPUT_FILE) as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as exc:
            raise AssertionError(
                f"Output file {OUTPUT_FILE} is not valid JSON: {exc}"
            )
    return data


N, VALUES = _read_input()
EXPECTED_TOTAL, EXPECTED_PREFIX = _expected(VALUES)


@pytest.fixture(scope="session")
def first_run():
    return _run_and_load()


def _as_int(value, label):
    if isinstance(value, bool):
        raise AssertionError(f"{label} must be an integer, got a boolean.")
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        assert value.is_integer(), f"{label} must be an integer value, got {value}."
        return int(value)
    raise AssertionError(f"{label} must be an integer, got {value!r}.")


def test_output_schema(first_run):
    data = first_run
    assert isinstance(data, dict), "Top-level JSON must be an object."
    assert set(data.keys()) == {"count", "total", "prefix_sum"}, (
        f"Output JSON must contain exactly the keys 'count', 'total', 'prefix_sum'; "
        f"got {sorted(data.keys())}."
    )
    assert isinstance(data["prefix_sum"], list), "'prefix_sum' must be a JSON array."


def test_count_matches(first_run):
    data = first_run
    count = _as_int(data["count"], "count")
    assert count == N, f"Expected count {N}, got {count}."
    assert len(data["prefix_sum"]) == N, (
        f"'prefix_sum' must have exactly {N} elements, got {len(data['prefix_sum'])}."
    )


def test_total_reduction(first_run):
    data = first_run
    total = _as_int(data["total"], "total")
    assert total == EXPECTED_TOTAL, (
        f"Reduction total is wrong: expected {EXPECTED_TOTAL}, got {total}."
    )


def test_exclusive_prefix_sum(first_run):
    data = first_run
    prefix = data["prefix_sum"]
    got = [_as_int(prefix[i], f"prefix_sum[{i}]") for i in range(len(prefix))]
    # First element of an exclusive scan is always 0.
    assert got[0] == 0, f"Exclusive scan must start with 0, got {got[0]}."
    # Full comparison against the independently computed expected scan.
    for i in range(N):
        assert got[i] == EXPECTED_PREFIX[i], (
            f"prefix_sum[{i}] is wrong: expected {EXPECTED_PREFIX[i]}, got {got[i]}. "
            "The scan must be correct across the whole array (spanning multiple "
            "workgroups), not just the first few elements."
        )
    # Relationship between the scan and the reduction total.
    assert got[N - 1] + VALUES[N - 1] == _as_int(data["total"], "total"), (
        "prefix_sum[N-1] + input[N-1] must equal the reported total."
    )


def test_gpu_compute_pipeline_used():
    glsl_files = glob.glob(os.path.join(PROJECT_DIR, "**", "*.glsl"), recursive=True)
    assert glsl_files, (
        "No GLSL compute-shader source file (*.glsl) was found in the project. "
        "The scan/reduction must run on the GPU via a compute shader."
    )
    shader_ok = False
    for path in glsl_files:
        with open(path) as f:
            text = f.read().lower()
        if "void main" in text and "std430" in text and "buffer" in text:
            shader_ok = True
            break
    assert shader_ok, (
        "No GLSL file declares a compute shader with a 'void main' entry point and "
        "an 'std430' storage buffer."
    )

    gd_files = glob.glob(os.path.join(PROJECT_DIR, "**", "*.gd"), recursive=True)
    assert gd_files, "No GDScript (*.gd) files were found in the project."
    combined = ""
    for path in gd_files:
        with open(path) as f:
            combined += f.read() + "\n"
    required = [
        "create_local_rendering_device",
        "shader_create_from_spirv",
        "compute_pipeline_create",
        "compute_list_dispatch",
        "buffer_get_data",
    ]
    missing = [name for name in required if name not in combined]
    assert not missing, (
        "The GDScript does not drive a full RenderingDevice compute pipeline; "
        f"missing API calls: {missing}. A pure-CPU/GDScript scan does not satisfy "
        "the task."
    )


def test_deterministic_rerun(first_run):
    second = _run_and_load()
    assert _as_int(second["count"], "count") == _as_int(
        first_run["count"], "count"
    ), "Re-running the project produced a different 'count'."
    assert _as_int(second["total"], "total") == _as_int(
        first_run["total"], "total"
    ), "Re-running the project produced a different 'total'."
    first_prefix = [
        _as_int(v, f"first prefix_sum[{i}]")
        for i, v in enumerate(first_run["prefix_sum"])
    ]
    second_prefix = [
        _as_int(v, f"second prefix_sum[{i}]")
        for i, v in enumerate(second["prefix_sum"])
    ]
    assert second_prefix == first_prefix, (
        "Re-running the project produced a different 'prefix_sum'; the computation "
        "must be deterministic."
    )
