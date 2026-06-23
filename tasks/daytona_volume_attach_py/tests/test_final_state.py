import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
OUTPUT_LOG = os.path.join(PROJECT_DIR, "output.log")


def _read_log_lines():
    assert os.path.isfile(OUTPUT_LOG), f"Expected log file at {OUTPUT_LOG} but it does not exist."
    with open(OUTPUT_LOG, "r", encoding="utf-8") as f:
        return [line.rstrip("\n") for line in f.readlines() if line.strip() != ""]


def _get_run_id():
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, "ZEALT_RUN_ID environment variable must be set during verification."
    return run_id


def test_output_log_exists():
    assert os.path.isfile(OUTPUT_LOG), (
        f"Output log file {OUTPUT_LOG} must exist after the task is completed."
    )


def test_marker_line_matches_run_id():
    run_id = _get_run_id()
    lines = _read_log_lines()
    marker_lines = [ln for ln in lines if ln.startswith("Marker:")]
    assert marker_lines, (
        f"Expected a line starting with 'Marker:' in {OUTPUT_LOG}, but found none. Lines: {lines!r}"
    )
    # take the first Marker line
    match = re.match(r"^Marker:\s*(.*)$", marker_lines[0])
    assert match, f"Marker line is malformed: {marker_lines[0]!r}"
    content = match.group(1).strip()
    expected = f"persistent {run_id}"
    assert content == expected, (
        f"Marker content mismatch. Expected '{expected}', got '{content}'."
    )


def test_volume_count_line_is_positive_integer():
    lines = _read_log_lines()
    count_lines = [ln for ln in lines if ln.startswith("VolumeCount:")]
    assert count_lines, (
        f"Expected a line starting with 'VolumeCount:' in {OUTPUT_LOG}, but found none. Lines: {lines!r}"
    )
    match = re.match(r"^VolumeCount:\s*(-?\d+)\s*$", count_lines[0])
    assert match, f"VolumeCount line is malformed (expected integer): {count_lines[0]!r}"
    n = int(match.group(1))
    assert n >= 1, f"VolumeCount must be a positive integer (>=1), got {n}."


def test_volume_exists_in_daytona_account():
    run_id = _get_run_id()
    expected_name = f"vol-{run_id}"
    try:
        from daytona import Daytona
    except ImportError as exc:
        pytest.fail(f"Daytona Python SDK not importable in verifier env: {exc}")

    daytona = Daytona()
    volumes = daytona.volume.list()
    names = []
    for v in volumes:
        name = getattr(v, "name", None)
        if name is None and isinstance(v, dict):
            name = v.get("name")
        names.append(name)
    assert expected_name in names, (
        f"Expected a Daytona volume named '{expected_name}' to exist. Found volume names: {names!r}"
    )
