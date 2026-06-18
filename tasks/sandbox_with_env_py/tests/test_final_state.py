import os

import pytest

LOG_FILE = "/home/user/myproject/output.log"


def _get_run_id() -> str:
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, "ZEALT_RUN_ID environment variable is not set in the verifier environment."
    return run_id


def _read_log_lines():
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} does not exist."
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        raw_lines = f.readlines()
    return [line.rstrip("\n").rstrip() for line in raw_lines if line.strip()]


def test_log_file_exists():
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} does not exist."


def test_my_var_line():
    run_id = _get_run_id()
    expected = f"MY_VAR: hello-{run_id}"
    lines = _read_log_lines()
    assert len(lines) >= 1, f"Log file has no non-empty lines; got: {lines}"
    assert lines[0] == expected, (
        f"First non-empty line of {LOG_FILE} does not match expected MY_VAR line. "
        f"Expected: {expected!r}. Got: {lines[0]!r}."
    )


def test_app_mode_line():
    expected = "APP_MODE: production"
    lines = _read_log_lines()
    assert len(lines) >= 2, (
        f"Log file must contain at least two non-empty lines; got: {lines}"
    )
    assert lines[1] == expected, (
        f"Second non-empty line of {LOG_FILE} does not match expected APP_MODE line. "
        f"Expected: {expected!r}. Got: {lines[1]!r}."
    )


def test_log_file_has_no_extra_lines():
    """The log file must contain exactly the two required lines (ignoring blank lines)."""
    lines = _read_log_lines()
    assert len(lines) == 2, (
        f"Log file {LOG_FILE} should contain exactly two non-empty lines; got {len(lines)}: {lines}"
    )
