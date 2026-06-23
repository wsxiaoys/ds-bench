import json
import os
import subprocess

PROJECT_DIR = "/home/user/myproject"
VALIDATOR_PATH = os.path.join(PROJECT_DIR, "src", "validator.ts")
CLI_PATH = os.path.join(PROJECT_DIR, "cli.ts")

REDACTED_TOKEN = "<redacted>"
BYPATH_KEYS = ("byPath", "flatByPath", "flatProblemsByPath")


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


def _contains_bypath_key(text: str) -> bool:
    return any(key in text for key in BYPATH_KEYS)


# ---------------------------------------------------------------------------
# Sanity: the executor produced the expected entry-points.
# ---------------------------------------------------------------------------


def test_cli_entrypoint_exists():
    """The CLI entrypoint required by the acceptance criteria exists."""
    assert os.path.isfile(CLI_PATH), (
        f"Expected CLI entrypoint at {CLI_PATH}."
    )


def test_validator_module_exists():
    """The validator module required by the acceptance criteria exists."""
    assert os.path.isfile(VALIDATOR_PATH), (
        f"Expected validator module at {VALIDATOR_PATH}."
    )


# ---------------------------------------------------------------------------
# Behavioural tests (Criteria 1-5)
# ---------------------------------------------------------------------------


def test_1_valid_payload_is_accepted():
    """Criterion 1: a valid sign-up payload is accepted with VALID + JSON."""
    payload = {
        "username": "alice123",
        "password": "Str0ngPa$$word!",
        "confirm": "Str0ngPa$$word!",
        "ssn": "123-45-6789",
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code for a valid payload: "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}"
    )

    lines = _stdout_lines(result.stdout)
    assert lines and lines[0] == "VALID", (
        f"Expected first non-empty stdout line to be 'VALID', got: {lines!r} "
        f"(stderr={result.stderr!r})"
    )
    assert len(lines) >= 2, (
        f"Expected validated JSON on the line after VALID, got: {lines!r}"
    )
    try:
        validated = json.loads(lines[1])
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"Second stdout line is not valid JSON: {lines[1]!r} (error: {exc})"
        )
    assert validated.get("username") == "alice123", (
        f"Validated username mismatch: {validated!r}"
    )
    assert validated.get("password") == "Str0ngPa$$word!", (
        f"Validated password mismatch: {validated!r}"
    )
    assert validated.get("confirm") == "Str0ngPa$$word!", (
        f"Validated confirm mismatch: {validated!r}"
    )
    assert validated.get("ssn") == "123-45-6789", (
        f"Validated ssn mismatch: {validated!r}"
    )


def test_2_weak_password_redacts_and_does_not_echo_raw_value():
    """Criterion 2: weak password produces INVALID with <redacted> and no raw password leak."""
    raw_password = "Tinypw9!"
    payload = {
        "username": "alice123",
        "password": raw_password,
        "confirm": raw_password,
        "ssn": "123-45-6789",
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID: "), (
        f"Expected stdout to start with 'INVALID: ' for weak password, got: "
        f"{result.stdout!r}"
    )
    assert REDACTED_TOKEN in result.stdout, (
        f"Expected stdout to contain the literal '<redacted>' token, got: "
        f"{result.stdout!r}"
    )
    assert raw_password not in result.stdout, (
        f"Raw password value {raw_password!r} leaked into stdout: "
        f"{result.stdout!r}"
    )
    assert _contains_bypath_key(result.stdout), (
        f"Expected stdout to contain a byPath-style key (one of {BYPATH_KEYS}), "
        f"got: {result.stdout!r}"
    )


def test_3_bad_ssn_redacts_and_does_not_echo_raw_value():
    """Criterion 3: malformed ssn produces INVALID with <redacted> and no raw ssn digits leak."""
    raw_ssn = "987654321"
    payload = {
        "username": "alice123",
        "password": "Str0ngPa$$word!",
        "confirm": "Str0ngPa$$word!",
        "ssn": raw_ssn,
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID: "), (
        f"Expected stdout to start with 'INVALID: ' for bad ssn, got: "
        f"{result.stdout!r}"
    )
    assert REDACTED_TOKEN in result.stdout, (
        f"Expected stdout to contain the literal '<redacted>' token, got: "
        f"{result.stdout!r}"
    )
    assert raw_ssn not in result.stdout, (
        f"Raw ssn value {raw_ssn!r} leaked into stdout: {result.stdout!r}"
    )


def test_4_mismatched_confirm_does_not_echo_confirm_value():
    """Criterion 4: mismatched confirm produces INVALID and does not echo the confirm value."""
    raw_confirm = "OtherStr0ng#Password"
    payload = {
        "username": "alice123",
        "password": "Str0ngPa$$word!",
        "confirm": raw_confirm,
        "ssn": "123-45-6789",
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID: "), (
        f"Expected stdout to start with 'INVALID: ' for confirm mismatch, got: "
        f"{result.stdout!r}"
    )
    assert raw_confirm not in result.stdout, (
        f"Raw confirm value {raw_confirm!r} leaked into stdout: "
        f"{result.stdout!r}"
    )


def test_5_weak_password_with_valid_ssn_still_redacts_sensitive_values():
    """Criterion 5: weak password + valid (but sensitive) ssn — sensitive values never echoed."""
    raw_password = "weakling"
    raw_ssn = "111-22-3333"
    payload = {
        "username": "bob42",
        "password": raw_password,
        "confirm": raw_password,
        "ssn": raw_ssn,
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID: "), (
        f"Expected stdout to start with 'INVALID: ' for weak password, got: "
        f"{result.stdout!r}"
    )
    assert REDACTED_TOKEN in result.stdout, (
        f"Expected stdout to contain the literal '<redacted>' token, got: "
        f"{result.stdout!r}"
    )
    assert raw_password not in result.stdout, (
        f"Raw password value {raw_password!r} leaked into stdout: "
        f"{result.stdout!r}"
    )
    assert raw_ssn not in result.stdout, (
        f"Raw ssn value {raw_ssn!r} leaked into stdout even though ssn was "
        f"structurally valid: {result.stdout!r}"
    )


# ---------------------------------------------------------------------------
# Implementation-shape test (Criterion 6)
# ---------------------------------------------------------------------------


def test_6_validator_source_uses_configure_with_actual_or_problem():
    """Criterion 6: validator source uses `.configure(` and references `actual` or `problem`."""
    assert os.path.isfile(VALIDATOR_PATH), (
        f"Expected validator module at {VALIDATOR_PATH}."
    )
    with open(VALIDATOR_PATH, encoding="utf-8") as f:
        source = f.read()
    assert ".configure(" in source, (
        "src/validator.ts must apply ArkType per-type error configuration "
        "via a `.configure(...)` call on the sensitive field types."
    )
    assert ("actual" in source) or ("problem" in source), (
        "src/validator.ts must reference at least one of the `actual` or "
        "`problem` configuration keys in its per-type `.configure(...)` call."
    )
