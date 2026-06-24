import json
import os
import subprocess

import pytest

RUN_ID_PATH = "/logs/artifacts/run-id"


def _read_run_id():
    assert os.path.isfile(RUN_ID_PATH), (
        f"run_id file {RUN_ID_PATH} is missing; cannot derive bucket name."
    )
    with open(RUN_ID_PATH) as f:
        run_id = f.read().strip()
    assert run_id, f"run_id file {RUN_ID_PATH} is empty."
    return run_id


@pytest.fixture(scope="module")
def bucket_name():
    run_id = _read_run_id()
    name = f"harbor-snap-{run_id}"
    import re
    name = re.sub(r"[^a-z0-9.-]", "-", name.lower())
    yield name
    # Finalizer: delete the bucket so re-runs (same run id) don't collide.
    # `tigris buckets delete` requires the bucket to be empty; the task does
    # not upload anything, so a plain delete is sufficient.
    subprocess.run(
        ["tigris", "buckets", "delete", name],
        capture_output=True,
        text=True,
        timeout=120,
    )


def test_bucket_present_in_list(bucket_name):
    """Priority 1: Use the Tigris CLI's JSON output to verify the bucket exists."""
    result = subprocess.run(
        ["tigris", "buckets", "list", "--format", "json"],
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, (
        "`tigris buckets list --format json` failed with code "
        f"{result.returncode}.\nstdout: {result.stdout}\nstderr: {result.stderr}"
    )
    try:
        parsed = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        pytest.fail(
            "Failed to parse `tigris buckets list --format json` output as JSON: "
            f"{exc}\nstdout was:\n{result.stdout}"
        )

    # The CLI may return either a top-level list of bucket objects, or an
    # object containing a key like "Buckets"/"buckets". Handle both shapes
    # and collect every string value that could be a bucket name.
    def _collect_names(node):
        names = []
        if isinstance(node, list):
            for item in node:
                names.extend(_collect_names(item))
        elif isinstance(node, dict):
            for key, value in node.items():
                if key.lower() in {"name", "bucket", "bucketname"} and isinstance(value, str):
                    names.append(value)
                else:
                    names.extend(_collect_names(value))
        return names

    names = _collect_names(parsed)
    assert bucket_name in names, (
        f"Expected bucket '{bucket_name}' to appear in `tigris buckets list --format json`, "
        f"but it was not found. Collected names: {names}"
    )


def test_bucket_has_snapshots_enabled(bucket_name):
    """Priority 1: `tigris snapshots list <bucket>` succeeds only when snapshots
    are enabled on that bucket. For buckets created without --enable-snapshots,
    Tigris rejects snapshot operations.
    """
    result = subprocess.run(
        ["tigris", "snapshots", "list", bucket_name],
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, (
        f"Expected `tigris snapshots list {bucket_name}` to succeed (which "
        "indicates snapshots are enabled on the bucket), but it exited with "
        f"code {result.returncode}.\nstdout: {result.stdout}\nstderr: {result.stderr}\n"
        "Did you forget to pass `--enable-snapshots` when creating the bucket? "
        "Snapshots cannot be enabled on an existing bucket — the bucket must be "
        "recreated with `tigris buckets create <name> --enable-snapshots`."
    )
