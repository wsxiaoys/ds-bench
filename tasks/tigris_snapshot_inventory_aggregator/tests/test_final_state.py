import json
import os
import re
import shutil
import subprocess

import pytest

PROJECT_DIR = "/home/user/inv"
INDEX_JS = os.path.join(PROJECT_DIR, "index.js")
INVENTORY_FILE = os.path.join(PROJECT_DIR, "inventory.json")
RUN_ID_FILE = "/logs/artifacts/run-id"

def _read_run_id():
    assert os.path.isfile(RUN_ID_FILE), (
        f"Run id file {RUN_ID_FILE} does not exist; cannot derive bucket names."
    )
    with open(RUN_ID_FILE, "r") as f:
        run_id = f.read().strip()
    assert run_id, f"Run id file {RUN_ID_FILE} is empty."
    return run_id

def _prefix():
    run_id = _read_run_id()
    name = f"harbor-inv-{run_id}-"
    return re.sub(r"[^a-z0-9.-]", "-", name.lower())

def _bench_buckets():
    prefix = _prefix()
    return [f"{prefix}a", f"{prefix}b", f"{prefix}c"]

def _other_buckets():
    run_id = _read_run_id()
    return [
        f"harbor-other-{run_id}-x",
        f"harbor-other-{run_id}-y",
        f"harbor-other-{run_id}-z",
    ]


def _extract_list(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        return payload.get("snapshots") or payload.get("items") or []
    return []


EXPECTED_BUCKET_COUNT = 3


def _tigris_env():
    """Map Harbor's TIGRIS_STORAGE_* credentials onto the AWS-compatible
    variables consumed by the `tigris` CLI."""
    env = os.environ.copy()
    access_key = os.environ.get("TIGRIS_STORAGE_ACCESS_KEY_ID")
    secret_key = os.environ.get("TIGRIS_STORAGE_SECRET_ACCESS_KEY")
    assert access_key, (
        "TIGRIS_STORAGE_ACCESS_KEY_ID is not set in the verifier environment."
    )
    assert secret_key, (
        "TIGRIS_STORAGE_SECRET_ACCESS_KEY is not set in the verifier environment."
    )
    env["AWS_ACCESS_KEY_ID"] = access_key
    env["AWS_SECRET_ACCESS_KEY"] = secret_key
    env.setdefault("AWS_REGION", "auto")
    return env


def _run_tigris(args, timeout=120):
    return subprocess.run(
        ["tigris", *args],
        capture_output=True,
        text=True,
        env=_tigris_env(),
        cwd=PROJECT_DIR,
        timeout=timeout,
    )


def _list_snapshot_versions(bucket):
    """Return the set of snapshot version strings for `bucket` as reported by
    `tigris snapshots list <bucket> --format json`."""
    result = _run_tigris(
        ["snapshots", "list", bucket, "--format", "json"], timeout=120
    )
    assert result.returncode == 0, (
        f"'tigris snapshots list {bucket} --format json' failed: "
        f"returncode={result.returncode}, stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        pytest.fail(
            f"'tigris snapshots list {bucket} --format json' did not emit "
            f"valid JSON: {exc!s}; stdout={result.stdout!r}"
        )

    snaps = _extract_list(payload)
    assert isinstance(snaps, list), (
        f"Expected snapshots/items list in CLI output for bucket {bucket}, "
        f"got: {payload!r}"
    )

    return {
        str(s["version"])
        for s in snaps
        if isinstance(s, dict) and s.get("version")
    }


def _expected_inventory_truth():
    return {
        bucket: _list_snapshot_versions(bucket)
        for bucket in _bench_buckets()
    }


@pytest.fixture(scope="module", autouse=True)
def _cleanup_buckets_after_tests():
    """Run the test module, then tear down every bucket created by setup.sh
    so subsequent runs of this evaluation start from a clean Tigris account."""
    yield
    # Best-effort cleanup; do not fail the suite if a bucket is already gone.
    for bucket in _bench_buckets() + _other_buckets():
        _run_tigris(["buckets", "delete", bucket, "--yes"], timeout=120)


def test_tigris_cli_available():
    """Sanity check that we can find the Tigris CLI we use throughout the
    verifier."""
    assert shutil.which("tigris") is not None, (
        "tigris CLI binary not found in PATH; cannot verify final state."
    )


def test_index_js_authored_by_user():
    """The user must have authored /home/user/inv/index.js."""
    assert os.path.isfile(INDEX_JS), (
        f"Expected user-authored script at {INDEX_JS}, but it does not exist."
    )


def test_node_script_runs_and_prints_summary():
    """Priority 1: Re-run the user's script and assert exit code + stdout
    summary line. This also (re)produces /home/user/inv/inventory.json."""
    assert os.path.isfile(INDEX_JS), (
        f"Expected user-authored script at {INDEX_JS}; run cannot proceed."
    )

    truth = _expected_inventory_truth()
    expected_total = sum(len(v) for v in truth.values())

    result = subprocess.run(
        ["node", "index.js"],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        env=_tigris_env(),
        timeout=180,
    )
    assert result.returncode == 0, (
        f"'node index.js' failed with returncode {result.returncode}. "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}"
    )

    expected = f"{EXPECTED_BUCKET_COUNT} buckets, {expected_total} snapshots"
    assert result.stdout.strip() == expected, (
        f"Expected stdout of 'node index.js' to be exactly {expected!r}, "
        f"but got: {result.stdout!r}"
    )


def test_inventory_file_exists_after_run():
    assert os.path.isfile(INVENTORY_FILE), (
        f"Expected {INVENTORY_FILE} to exist after running index.js."
    )


def test_inventory_file_has_correct_keys_and_counts():
    with open(INVENTORY_FILE) as f:
        try:
            inventory = json.load(f)
        except json.JSONDecodeError as exc:
            pytest.fail(f"{INVENTORY_FILE} is not valid JSON: {exc!s}.")

    assert isinstance(inventory, dict), (
        f"{INVENTORY_FILE} must be a JSON object keyed by bucket name. "
        f"Got: {type(inventory).__name__}"
    )

    truth = _expected_inventory_truth()

    actual_keys = set(inventory.keys())
    expected_keys = set(truth.keys())
    assert actual_keys == expected_keys, (
        f"{INVENTORY_FILE} must have exactly the keys {sorted(expected_keys)}, "
        f"but it has {sorted(actual_keys)}. Distractor buckets must be filtered out."
    )

    for bucket, expected_versions in truth.items():
        value = inventory[bucket]

        assert isinstance(value, list), (
            f"inventory.json[{bucket!r}] must be a list of snapshot version "
            f"strings, got: {type(value).__name__}"
        )

        for v in value:
            assert isinstance(v, str) and v, (
                f"Each snapshot version under inventory.json[{bucket!r}] "
                f"must be a non-empty string, got: {v!r}"
            )

        assert len(value) == len(expected_versions), (
            f"inventory.json[{bucket!r}] must list {len(expected_versions)} "
            f"snapshot version(s); got {len(value)}: {value!r}"
        )


def test_inventory_versions_match_cli_truth():
    with open(INVENTORY_FILE) as f:
        inventory = json.load(f)

    truth = _expected_inventory_truth()

    for bucket, expected_versions in truth.items():
        recorded = set(inventory.get(bucket) or [])
        assert recorded == expected_versions, (
            f"Snapshot version IDs in inventory.json[{bucket!r}] do not "
            f"match the live Tigris CLI output. inventory.json reports "
            f"{sorted(recorded)}; tigris CLI reports {sorted(expected_versions)}."
        )


def test_inventory_versions_are_sorted_oldest_first():
    with open(INVENTORY_FILE) as f:
        inventory = json.load(f)

    for bucket, versions in inventory.items():
        assert versions == sorted(versions), (
            f"Snapshot versions for {bucket!r} must be sorted ascending; "
            f"got {versions!r}."
        )