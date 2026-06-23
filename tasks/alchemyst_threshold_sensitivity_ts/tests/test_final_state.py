import json
import os
import subprocess

import pytest

PROJECT_DIR = "/home/user/myproject"
DIST_ENTRY = os.path.join(PROJECT_DIR, "dist", "main.js")


def _run_cli(args, extra_env=None, remove_env=None, timeout=180):
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)
    if remove_env:
        for key in remove_env:
            env.pop(key, None)
    return subprocess.run(
        ["node", DIST_ENTRY, *args],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        env=env,
        timeout=timeout,
    )


def _parse_stdout_json(stdout, context):
    stripped = stdout.strip()
    assert stripped, f"Expected a JSON object on stdout for {context}, got empty stdout."
    # Find the first '{' and last '}' to be lenient about surrounding whitespace.
    start = stripped.find("{")
    end = stripped.rfind("}")
    assert start != -1 and end != -1 and end > start, (
        f"Could not locate a JSON object in stdout for {context}: {stripped!r}"
    )
    payload = stripped[start : end + 1]
    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"Stdout for {context} is not valid JSON: {exc}; stdout was: {stdout!r}"
        )


def _assert_result_schema(data, expected_thresholds, context):
    assert isinstance(data, dict), (
        f"Expected a JSON object for {context}, got: {type(data).__name__}"
    )
    assert "query" in data and isinstance(data["query"], str) and data["query"], (
        f"Expected non-empty 'query' string in output for {context}, got: {data!r}"
    )
    assert "results" in data and isinstance(data["results"], list), (
        f"Expected 'results' to be a list for {context}, got: {data!r}"
    )
    assert len(data["results"]) == len(expected_thresholds), (
        f"Expected {len(expected_thresholds)} result entries for {context}, "
        f"got {len(data['results'])}: {data['results']!r}"
    )
    for idx, (entry, expected_threshold) in enumerate(
        zip(data["results"], expected_thresholds)
    ):
        assert isinstance(entry, dict), (
            f"Result entry {idx} for {context} must be an object, got: {entry!r}"
        )
        assert "threshold" in entry and "count" in entry, (
            f"Result entry {idx} for {context} must contain 'threshold' and 'count' "
            f"fields, got: {entry!r}"
        )
        threshold = entry["threshold"]
        assert isinstance(threshold, (int, float)), (
            f"Result entry {idx} 'threshold' for {context} must be numeric, got: "
            f"{threshold!r}"
        )
        assert abs(float(threshold) - float(expected_threshold)) < 1e-6, (
            f"Result entry {idx} for {context}: expected threshold "
            f"{expected_threshold}, got {threshold}"
        )
        count = entry["count"]
        assert isinstance(count, int) and not isinstance(count, bool), (
            f"Result entry {idx} for {context}: 'count' must be a non-negative "
            f"integer, got: {count!r}"
        )
        assert count >= 0, (
            f"Result entry {idx} for {context}: 'count' must be >= 0, got: {count}"
        )


def test_dist_entry_built():
    assert os.path.isfile(DIST_ENTRY), (
        f"Compiled entrypoint {DIST_ENTRY} not found. The executor must build the "
        f"TypeScript project so that `node dist/main.js` runs."
    )


def test_ascending_thresholds_produce_monotonic_counts():
    """Step 1 in the truth verification plan."""
    expected = [0.5, 0.7, 0.9]
    result = _run_cli(["--thresholds", "0.5,0.7,0.9"])
    assert result.returncode == 0, (
        f"`node dist/main.js --thresholds 0.5,0.7,0.9` exited with "
        f"{result.returncode}. stderr: {result.stderr}; stdout: {result.stdout}"
    )
    data = _parse_stdout_json(result.stdout, "ascending thresholds run")
    _assert_result_schema(data, expected, "ascending thresholds run")

    counts = [entry["count"] for entry in data["results"]]
    for i in range(len(counts) - 1):
        assert counts[i] >= counts[i + 1], (
            f"Counts must be monotonically non-increasing as threshold increases; "
            f"got {counts} for thresholds {expected}."
        )
    assert counts[0] >= 1, (
        f"Expected the lowest threshold (0.5) to return at least one matching context, "
        f"got count={counts[0]}. The corpus must contain documents relevant to the query."
    )
    assert counts[0] > counts[-1], (
        f"Expected threshold sensitivity: count at 0.5 must strictly exceed count at "
        f"0.9 for the same query and corpus. Got counts={counts}."
    )


def test_reversed_thresholds_preserve_output_order():
    """Step 2 in the truth verification plan."""
    expected = [0.9, 0.7, 0.5]
    result = _run_cli(["--thresholds", "0.9,0.7,0.5"])
    assert result.returncode == 0, (
        f"`node dist/main.js --thresholds 0.9,0.7,0.5` exited with "
        f"{result.returncode}. stderr: {result.stderr}; stdout: {result.stdout}"
    )
    data = _parse_stdout_json(result.stdout, "reversed thresholds run")
    _assert_result_schema(data, expected, "reversed thresholds run")

    by_threshold = {
        round(float(entry["threshold"]), 6): entry["count"] for entry in data["results"]
    }
    ascending = [by_threshold[0.5], by_threshold[0.7], by_threshold[0.9]]
    for i in range(len(ascending) - 1):
        assert ascending[i] >= ascending[i + 1], (
            f"After re-sorting by ascending threshold, counts must be non-increasing. "
            f"Got {ascending} (thresholds 0.5, 0.7, 0.9)."
        )


def test_idempotent_rerun():
    """Step 3 in the truth verification plan: re-running must not fail."""
    expected = [0.5, 0.7, 0.9]
    result = _run_cli(["--thresholds", "0.5,0.7,0.9"])
    assert result.returncode == 0, (
        f"Second invocation of `node dist/main.js --thresholds 0.5,0.7,0.9` exited "
        f"with {result.returncode}. The CLI must be idempotent under the same "
        f"ZEALT_RUN_ID. stderr: {result.stderr}; stdout: {result.stdout}"
    )
    data = _parse_stdout_json(result.stdout, "idempotent rerun")
    _assert_result_schema(data, expected, "idempotent rerun")
    counts = [entry["count"] for entry in data["results"]]
    for i in range(len(counts) - 1):
        assert counts[i] >= counts[i + 1], (
            f"Counts on rerun must still be monotonically non-increasing as threshold "
            f"increases; got {counts}."
        )


def test_missing_api_key_fails():
    """Step 5 in the truth verification plan: API key must come from env."""
    result = _run_cli(
        ["--thresholds", "0.5,0.9"],
        remove_env=["ALCHEMYST_AI_API_KEY"],
        timeout=120,
    )
    assert result.returncode != 0, (
        "Expected the CLI to fail when ALCHEMYST_AI_API_KEY is not set, but it exited "
        f"with returncode={result.returncode}. stdout: {result.stdout}; "
        f"stderr: {result.stderr}"
    )
