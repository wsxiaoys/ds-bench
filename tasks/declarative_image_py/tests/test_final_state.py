import os
import re

import pytest


LOG_FILE = "/home/user/myproject/output.log"
VERSION_RE = re.compile(r"^\d+(?:\.\d+)+[A-Za-z0-9.\-+]*$")


def _read_log_lines():
    assert os.path.isfile(LOG_FILE), (
        f"Expected log file {LOG_FILE} to exist after the task completes."
    )
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        return [line.rstrip("\n") for line in f.readlines() if line.strip()]


def _find_value(lines, prefix):
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(prefix):
            return stripped[len(prefix):].strip()
    return None


def test_output_log_has_requests_version():
    lines = _read_log_lines()
    value = _find_value(lines, "requests:")
    assert value is not None, (
        f"Expected a line starting with 'requests:' in {LOG_FILE}. "
        f"Got lines: {lines!r}"
    )
    assert VERSION_RE.match(value), (
        f"Expected the 'requests:' line in {LOG_FILE} to contain a dotted "
        f"version string (e.g. '2.32.3'), got: {value!r}"
    )


def test_output_log_has_yaml_version():
    lines = _read_log_lines()
    value = _find_value(lines, "yaml:")
    assert value is not None, (
        f"Expected a line starting with 'yaml:' in {LOG_FILE}. "
        f"Got lines: {lines!r}"
    )
    assert VERSION_RE.match(value), (
        f"Expected the 'yaml:' line in {LOG_FILE} to contain a dotted "
        f"version string (e.g. '6.0.2'), got: {value!r}"
    )


def test_sandbox_deleted_after_task():
    api_key = os.environ.get("DAYTONA_API_KEY")
    assert api_key, (
        "DAYTONA_API_KEY is not set; cannot verify sandbox cleanup against "
        "the real Daytona service."
    )
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, (
        "ZEALT_RUN_ID is not set; cannot determine the expected sandbox name."
    )
    expected_name = f"decl-py-{run_id}"

    try:
        from daytona import Daytona, DaytonaConfig
    except ImportError as exc:
        pytest.fail(
            f"Daytona Python SDK is not installed in the verifier environment: {exc}"
        )

    client = Daytona(DaytonaConfig(api_key=api_key))
    sandboxes = client.list()

    remaining = []
    for sb in sandboxes:
        name = getattr(sb, "name", None)
        if name is None:
            # Some SDK builds expose name under a nested attribute.
            name = getattr(getattr(sb, "info", None), "name", None)
        if name == expected_name:
            remaining.append(name)

    assert not remaining, (
        f"Expected sandbox named '{expected_name}' to be deleted, but it still "
        f"exists in Daytona. Found matching sandboxes: {remaining!r}"
    )
