import json
import os
import subprocess

PROJECT_DIR = "/home/user/myproject"
CLI_PATH = os.path.join(PROJECT_DIR, "cli.ts")


def _run_cli(payload: dict) -> subprocess.CompletedProcess[str]:
    """Invoke the CLI by piping a JSON payload through stdin."""
    return subprocess.run(
        ["npx", "--no-install", "tsx", "cli.ts"],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=120,
    )


def _stdout_lines(stdout: str) -> list[str]:
    return [line for line in stdout.splitlines() if line.strip() != ""]


def _expect_valid(result: subprocess.CompletedProcess[str]) -> dict:
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0] == "VALID", (
        f"Expected first non-empty stdout line to be 'VALID', got: {lines!r} "
        f"(stderr={result.stderr!r})"
    )
    assert len(lines) >= 2, (
        f"Expected JSON-stringified state after VALID, got: {lines!r}"
    )
    try:
        return json.loads(lines[1])
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"Line after VALID is not valid JSON: {lines[1]!r} (error: {exc})"
        )


def _expect_invalid(result: subprocess.CompletedProcess[str]) -> None:
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID: "), (
        f"Expected stdout to start with 'INVALID: ', got: {result.stdout!r}"
    )


# ---------------------------------------------------------------------------
# Sanity
# ---------------------------------------------------------------------------


def test_cli_entrypoint_exists():
    """Sanity: the CLI entrypoint required by the acceptance criteria exists."""
    assert os.path.isfile(CLI_PATH), f"Expected CLI entrypoint at {CLI_PATH}."


# ---------------------------------------------------------------------------
# Behavioural criteria
# ---------------------------------------------------------------------------


def test_idle_start_moves_to_loading():
    """Criterion 1: Idle + Start -> Loading."""
    payload = {
        "initial": {"status": "idle"},
        "events": [{"type": "start", "at": 1000}],
    }
    result = _run_cli(payload)
    final = _expect_valid(result)
    assert final == {"status": "loading", "startedAt": 1000}, (
        f"Expected loading state with startedAt=1000, got: {final!r}"
    )


def test_loading_resolve_moves_to_success():
    """Criterion 2: Loading + Resolve -> Success."""
    payload = {
        "initial": {"status": "loading", "startedAt": 1000},
        "events": [
            {"type": "resolve", "data": {"hello": "world"}, "at": 2000}
        ],
    }
    result = _run_cli(payload)
    final = _expect_valid(result)
    assert final == {
        "status": "success",
        "data": {"hello": "world"},
        "fetchedAt": 2000,
    }, f"Expected success state, got: {final!r}"


def test_loading_reject_moves_to_failure():
    """Criterion 3: Loading + Reject -> Failure."""
    payload = {
        "initial": {"status": "loading", "startedAt": 1000},
        "events": [
            {
                "type": "reject",
                "code": 503,
                "reason": "upstream timeout",
                "at": 2500,
            }
        ],
    }
    result = _run_cli(payload)
    final = _expect_valid(result)
    assert final == {
        "status": "failure",
        "code": 503,
        "reason": "upstream timeout",
    }, f"Expected failure state, got: {final!r}"


def test_reset_returns_to_idle_from_any_state():
    """Criterion 4: any state + Reset -> Idle."""
    payload = {
        "initial": {"status": "failure", "code": 500, "reason": "boom"},
        "events": [{"type": "reset"}],
    }
    result = _run_cli(payload)
    final = _expect_valid(result)
    assert final == {"status": "idle"}, (
        f"Expected idle state after reset, got: {final!r}"
    )


def test_invalid_initial_state_tag_is_rejected():
    """Criterion 5: an unknown status tag must be rejected."""
    payload = {"initial": {"status": "bogus"}, "events": []}
    result = _run_cli(payload)
    _expect_invalid(result)


def test_invalid_event_payload_missing_field_is_rejected():
    """Criterion 6: a Start event missing required `at` must be rejected."""
    payload = {
        "initial": {"status": "idle"},
        "events": [{"type": "start"}],
    }
    result = _run_cli(payload)
    _expect_invalid(result)


def test_out_of_range_failure_code_is_rejected():
    """Criterion 7: Failure.code outside [400, 599] must be rejected."""
    payload = {
        "initial": {"status": "failure", "code": 200, "reason": "not a failure"},
        "events": [],
    }
    result = _run_cli(payload)
    _expect_invalid(result)


def test_multi_event_happy_path():
    """Sanity: replay multiple events end-to-end."""
    payload = {
        "initial": {"status": "idle"},
        "events": [
            {"type": "start", "at": 10},
            {"type": "resolve", "data": [1, 2, 3], "at": 20},
            {"type": "reset"},
        ],
    }
    result = _run_cli(payload)
    final = _expect_valid(result)
    assert final == {"status": "idle"}, (
        f"Expected final state to be idle after reset, got: {final!r}"
    )
