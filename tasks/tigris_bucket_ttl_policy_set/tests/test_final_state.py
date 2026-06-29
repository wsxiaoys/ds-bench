import json
import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/ttl-task"
RUN_ID_PATH = "/logs/artifacts/run-id"


def _tigris_env():
    """Map Harbor's TIGRIS_STORAGE_* credentials onto the AWS-compatible
    variables consumed by the `tigris` CLI."""
    env = os.environ.copy()
    access_key = os.environ.get("TIGRIS_STORAGE_ACCESS_KEY_ID")
    secret_key = os.environ.get("TIGRIS_STORAGE_SECRET_ACCESS_KEY")
    assert access_key, "TIGRIS_STORAGE_ACCESS_KEY_ID is not set in the verifier environment."
    assert secret_key, "TIGRIS_STORAGE_SECRET_ACCESS_KEY is not set in the verifier environment."
    env["AWS_ACCESS_KEY_ID"] = access_key
    env["AWS_SECRET_ACCESS_KEY"] = secret_key
    env.setdefault("AWS_REGION", "auto")
    return env


def _run_id():
    assert os.path.isfile(RUN_ID_PATH), (
        f"Expected run id file at {RUN_ID_PATH} to exist for the verifier."
    )
    with open(RUN_ID_PATH) as f:
        value = f.read().strip()
    assert value, f"Run id file {RUN_ID_PATH} is empty."
    return value


def _bucket_name():
    import re
    name = f"harbor-ttl-{_run_id()}"
    name = re.sub(r"[^a-z0-9.-]", "-", name.lower())
    return name


def _run_tigris(args, timeout=120):
    return subprocess.run(
        ["tigris", *args],
        capture_output=True,
        text=True,
        env=_tigris_env(),
        cwd=PROJECT_DIR,
        timeout=timeout,
    )


@pytest.fixture(scope="module", autouse=True)
def cleanup_bucket_after_tests():
    """Yield to the tests, then delete the bucket so subsequent runs are clean."""
    yield
    bucket_name = _bucket_name()
    # Best-effort cleanup; do not fail the suite if the bucket is already gone.
    _run_tigris(["buckets", "delete", bucket_name, "--yes"], timeout=120)


def test_bucket_appears_in_list():
    """Priority 1: confirm via Tigris CLI that the new bucket exists."""
    bucket_name = _bucket_name()
    result = _run_tigris(["buckets", "list", "--format", "json"])
    assert result.returncode == 0, (
        f"'tigris buckets list --format json' failed: returncode="
        f"{result.returncode}, stderr={result.stderr!r}"
    )
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        pytest.fail(
            f"'tigris buckets list --format json' returned invalid JSON: {exc}. "
            f"stdout={result.stdout!r}"
        )
    if isinstance(payload, dict):
        buckets = payload.get("items", []) or payload.get("buckets", [])
    else:
        buckets = payload
    bucket_names = [b.get("name") for b in buckets if isinstance(b, dict)]
    assert bucket_name in bucket_names, (
        f"Expected bucket {bucket_name!r} to be present after the task completed, "
        f"but it was not found. Existing buckets: {bucket_names}"
    )


def _flatten_for_search(obj):
    """Walk a nested JSON value and yield (key_path, value) pairs where the
    value is a primitive (str/int/float/bool)."""
    if isinstance(obj, dict):
        for key, value in obj.items():
            if isinstance(value, (dict, list)):
                for sub in _flatten_for_search(value):
                    yield sub
            else:
                yield str(key), value
    elif isinstance(obj, list):
        for item in obj:
            if isinstance(item, (dict, list)):
                for sub in _flatten_for_search(item):
                    yield sub
            else:
                yield "", item


def test_bucket_ttl_is_seven_days():
    """Priority 1: confirm via Tigris CLI that the bucket's TTL is 7 days.

    The Tigris CLI documents `tigris buckets lifecycle create <name> --expire-days 7` as the
    canonical way to set a bucket's object-expiration TTL. The verifier
    inspects the bucket configuration with `tigris buckets lifecycle list --json`
    and asserts that a TTL/expiration-related property reflects a 7-day
    window.
    """
    bucket_name = _bucket_name()
    result = _run_tigris(["buckets", "lifecycle", "list", bucket_name, "--json"])
    assert result.returncode == 0, (
        f"'tigris buckets lifecycle list {bucket_name} --json' failed: returncode="
        f"{result.returncode}, stderr={result.stderr!r}"
    )
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        pytest.fail(
            f"'tigris buckets lifecycle list {bucket_name} --json' returned invalid "
            f"JSON: {exc}. stdout={result.stdout!r}"
        )

    if isinstance(payload, list):
        for rule in payload:
            if isinstance(rule, dict):
                expiration = str(rule.get("expiration", "")).lower()
                if expiration == "7d" or "7 day" in expiration:
                    return
        pytest.fail(
            "Did not find a lifecycle rule reflecting a 7-day expiration "
            f"in `tigris buckets lifecycle list {bucket_name} --json` output. "
            f"Payload: {payload!r}"
        )

    pytest.fail(
        f"Unexpected payload shape for `tigris buckets lifecycle list {bucket_name} --json`: "
        f"{type(payload).__name__}. Payload: {payload!r}"
    )
