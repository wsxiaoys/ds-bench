import json
import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/myproject"
SNAPSHOTS_JSON_PATH = os.path.join(PROJECT_DIR, "snapshots.json")
LOG_PATH = os.path.join(PROJECT_DIR, "output.log")


def _run_id():
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, "ZEALT_RUN_ID environment variable is not set in the verifier environment."
    return run_id


def _expected_snapshot_name():
    return f"snap-{_run_id()}"


def _extract_image(entry):
    """Return the image string from a snapshot JSON entry, tolerating field-name variants."""
    for key in ("imageName", "image", "image_name"):
        value = entry.get(key)
        if isinstance(value, str) and value:
            return value
    return ""


def _extract_name(entry):
    for key in ("name", "snapshotName", "snapshot_name"):
        value = entry.get(key)
        if isinstance(value, str) and value:
            return value
    return ""


def _extract_id(entry):
    for key in ("id", "snapshotId", "snapshot_id"):
        value = entry.get(key)
        if isinstance(value, str) and value:
            return value
    return ""


def _load_snapshots_json():
    assert os.path.isfile(SNAPSHOTS_JSON_PATH), (
        f"Expected snapshots JSON file at {SNAPSHOTS_JSON_PATH} but it does not exist."
    )
    with open(SNAPSHOTS_JSON_PATH, "r", encoding="utf-8") as f:
        text = f.read()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        pytest.fail(
            f"snapshots.json at {SNAPSHOTS_JSON_PATH} is not valid JSON: {exc}. "
            f"First 200 chars: {text[:200]!r}"
        )
    # The CLI emits either a top-level list or a wrapper object with an `items` array.
    if isinstance(data, dict):
        for key in ("items", "snapshots", "data"):
            if key in data and isinstance(data[key], list):
                return data[key]
        pytest.fail(
            f"snapshots.json is a JSON object but does not contain a list under 'items', "
            f"'snapshots', or 'data'. Top-level keys: {list(data.keys())}"
        )
    assert isinstance(data, list), (
        f"snapshots.json must contain a JSON list of snapshots, got {type(data).__name__}."
    )
    return data


def test_snapshots_json_contains_created_snapshot():
    expected_name = _expected_snapshot_name()
    entries = _load_snapshots_json()
    matches = [e for e in entries if isinstance(e, dict) and _extract_name(e) == expected_name]
    assert len(matches) == 1, (
        f"Expected exactly one snapshot entry named {expected_name!r} in {SNAPSHOTS_JSON_PATH}, "
        f"found {len(matches)}. Available names: "
        f"{[_extract_name(e) for e in entries if isinstance(e, dict)]}"
    )
    entry = matches[0]
    image = _extract_image(entry)
    assert image.startswith("python:3.11-slim"), (
        f"Snapshot {expected_name!r} should be built from image 'python:3.11-slim', "
        f"got image={image!r}."
    )
    snapshot_id = _extract_id(entry)
    assert snapshot_id, (
        f"Snapshot {expected_name!r} entry is missing a non-empty id field. Entry: {entry!r}"
    )


def test_output_log_contains_expected_summary_line():
    expected_name = _expected_snapshot_name()
    assert os.path.isfile(LOG_PATH), f"Expected log file at {LOG_PATH} but it does not exist."
    with open(LOG_PATH, "r", encoding="utf-8") as f:
        log_text = f.read()

    # Pull the snapshot id from snapshots.json so we can match the log line exactly.
    entries = _load_snapshots_json()
    matches = [e for e in entries if isinstance(e, dict) and _extract_name(e) == expected_name]
    assert matches, (
        f"snapshots.json does not contain snapshot {expected_name!r}; "
        f"cannot validate output.log line."
    )
    expected_id = _extract_id(matches[0])
    assert expected_id, f"Snapshot {expected_name!r} in snapshots.json has no id."

    pattern = re.compile(
        rf"^Snapshot:\s+{re.escape(expected_name)}\s+->\s+id\s+{re.escape(expected_id)}\s*$",
        re.MULTILINE,
    )
    assert pattern.search(log_text), (
        f"Expected a line matching 'Snapshot: {expected_name} -> id {expected_id}' in {LOG_PATH}. "
        f"Actual contents: {log_text!r}"
    )


def test_snapshot_exists_on_daytona_control_plane():
    """Use the real Daytona CLI to confirm the snapshot was registered on the control plane."""
    expected_name = _expected_snapshot_name()
    api_key = os.environ.get("DAYTONA_API_KEY")
    assert api_key, "DAYTONA_API_KEY environment variable is not set in the verifier environment."

    # Authenticate the verifier's CLI session.
    login = subprocess.run(
        ["daytona", "login", "--api-key", api_key],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert login.returncode == 0, (
        f"`daytona login` failed in verifier. stdout: {login.stdout!r}, stderr: {login.stderr!r}"
    )

    listing = subprocess.run(
        ["daytona", "snapshot", "list", "--format", "json"],
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert listing.returncode == 0, (
        f"`daytona snapshot list --format json` failed in verifier. "
        f"stdout: {listing.stdout!r}, stderr: {listing.stderr!r}"
    )

    try:
        data = json.loads(listing.stdout)
    except json.JSONDecodeError as exc:
        pytest.fail(
            f"Verifier could not parse `daytona snapshot list --format json` output as JSON: "
            f"{exc}. First 200 chars: {listing.stdout[:200]!r}"
        )

    if isinstance(data, dict):
        for key in ("items", "snapshots", "data"):
            if key in data and isinstance(data[key], list):
                data = data[key]
                break
    assert isinstance(data, list), (
        f"Expected a JSON list from `daytona snapshot list`, got {type(data).__name__}."
    )

    live_matches = [e for e in data if isinstance(e, dict) and _extract_name(e) == expected_name]
    assert len(live_matches) >= 1, (
        f"Snapshot {expected_name!r} was not found on the live Daytona control plane. "
        f"Available names: {[_extract_name(e) for e in data if isinstance(e, dict)]}"
    )

    # Cross-check the id reported live against the id stored by the agent.
    file_entries = _load_snapshots_json()
    file_matches = [
        e for e in file_entries if isinstance(e, dict) and _extract_name(e) == expected_name
    ]
    assert file_matches, (
        f"snapshots.json does not contain snapshot {expected_name!r} for cross-check."
    )
    file_id = _extract_id(file_matches[0])
    live_ids = {_extract_id(e) for e in live_matches}
    assert file_id in live_ids, (
        f"Snapshot id {file_id!r} from snapshots.json does not match any live snapshot id "
        f"for name {expected_name!r}. Live ids: {sorted(live_ids)}."
    )
