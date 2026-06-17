import json
import os
import re
import subprocess

PROJECT_DIR = "/home/user/myproject"
EMIT_PATH = os.path.join(PROJECT_DIR, "src", "emit.ts")
CLI_PATH = os.path.join(PROJECT_DIR, "cli.ts")


def _run_cli(args: list) -> subprocess.CompletedProcess[str]:
    """Invoke the CLI by piping {"args": [...]} through stdin."""
    return subprocess.run(
        ["npx", "--no-install", "tsx", "cli.ts"],
        input=json.dumps({"args": args}),
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=120,
    )


def _stdout_lines(stdout: str) -> list[str]:
    return [line for line in stdout.splitlines() if line.strip() != ""]


def _parse_ok(stdout: str) -> dict:
    lines = _stdout_lines(stdout)
    assert lines, f"Expected at least one line of stdout, got: {stdout!r}"
    first = lines[0]
    assert first.startswith("OK "), (
        f"Expected stdout to start with 'OK ', got: {first!r}"
    )
    payload = first[len("OK "):]
    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"OK payload is not valid JSON: {payload!r} (error: {exc})"
        )


# ---------------------------------------------------------------------------
# Behavioural tests (Criteria 1-7)
# ---------------------------------------------------------------------------


def test_cli_entrypoint_exists():
    """Sanity: the CLI entrypoint required by the acceptance criteria exists."""
    assert os.path.isfile(CLI_PATH), f"Expected CLI entrypoint at {CLI_PATH}."


def test_two_element_call_succeeds_with_empty_tags_and_no_payload():
    """Criterion 1: ['click', 1000] succeeds; tags is [], payload is omitted."""
    result = _run_cli(["click", 1000])
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    body = _parse_ok(result.stdout)
    assert body.get("ok") is True, f"Expected ok=true, got: {body!r}"
    event = body.get("event")
    assert isinstance(event, dict), f"Expected event dict, got: {body!r}"
    assert event.get("name") == "click", (
        f"Expected event.name == 'click', got: {event!r}"
    )
    assert event.get("timestamp") == 1000, (
        f"Expected event.timestamp == 1000, got: {event!r}"
    )
    assert event.get("tags") == [], (
        f"Expected event.tags == [], got: {event!r}"
    )
    assert "payload" not in event, (
        f"Expected event to NOT contain 'payload' when no payload arg was "
        f"provided, got: {event!r}"
    )


def test_three_element_call_with_payload_succeeds():
    """Criterion 2: 3-element call with payload succeeds."""
    payload_obj = {"kind": "user", "data": {"id": 42}}
    result = _run_cli(["signup", 1717000000, payload_obj])
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    body = _parse_ok(result.stdout)
    event = body.get("event", {})
    assert event.get("name") == "signup", (
        f"Expected event.name == 'signup', got: {event!r}"
    )
    assert event.get("timestamp") == 1717000000, (
        f"Expected event.timestamp == 1717000000, got: {event!r}"
    )
    assert event.get("payload") == payload_obj, (
        f"Expected event.payload == {payload_obj!r}, got: {event!r}"
    )
    assert event.get("tags") == [], (
        f"Expected event.tags == [], got: {event!r}"
    )


def test_four_plus_element_call_with_variadic_tags_succeeds():
    """Criterion 3: 4+ element call with variadic tags succeeds."""
    payload_obj = {"kind": "page", "data": "home"}
    result = _run_cli(["track", 2000, payload_obj, "alpha", "beta", "gamma"])
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    body = _parse_ok(result.stdout)
    event = body.get("event", {})
    assert event.get("name") == "track", (
        f"Expected event.name == 'track', got: {event!r}"
    )
    assert event.get("timestamp") == 2000, (
        f"Expected event.timestamp == 2000, got: {event!r}"
    )
    payload = event.get("payload", {})
    assert payload.get("kind") == "page", (
        f"Expected event.payload.kind == 'page', got: {event!r}"
    )
    assert event.get("tags") == ["alpha", "beta", "gamma"], (
        f"Expected event.tags == ['alpha','beta','gamma'], got: {event!r}"
    )


def test_tag_length_31_is_rejected():
    """Criterion 4: a tag of length 31 must be rejected.

    The optional payload is omitted; the over-long string falls into the
    variadic rest position, which should fail the tag length constraint.
    """
    too_long = "x" * 31
    result = _run_cli(["track", 2000, too_long])
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("ERR "), (
        f"Expected stdout to start with 'ERR ' for tag of length 31, "
        f"got: {result.stdout!r}"
    )


def test_negative_timestamp_is_rejected():
    """Criterion 5: timestamp = -1 must be rejected."""
    result = _run_cli(["click", -1])
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("ERR "), (
        f"Expected stdout to start with 'ERR ' for negative timestamp, "
        f"got: {result.stdout!r}"
    )


def test_event_name_with_space_is_rejected():
    """Criterion 6: eventName containing a space must be rejected."""
    result = _run_cli(["hello world", 1000])
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("ERR "), (
        f"Expected stdout to start with 'ERR ' for non-alphanumeric eventName, "
        f"got: {result.stdout!r}"
    )


def test_missing_required_element_is_rejected():
    """Criterion 7: missing required element (timestamp) must be rejected."""
    result = _run_cli(["click"])
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("ERR "), (
        f"Expected stdout to start with 'ERR ' when a required argument is "
        f"missing, got: {result.stdout!r}"
    )


# ---------------------------------------------------------------------------
# Implementation-shape test (Criterion 8)
# ---------------------------------------------------------------------------


def _read_emit_source() -> str:
    assert os.path.isfile(EMIT_PATH), (
        f"Expected emit module at {EMIT_PATH}."
    )
    with open(EMIT_PATH, encoding="utf-8") as f:
        return f.read()


def test_emit_source_uses_type_fn():
    """Criterion 8: src/emit.ts must build the validated function with `type.fn`."""
    source = _read_emit_source()
    assert re.search(r"from\s+['\"]arktype['\"]", source), (
        "src/emit.ts must import from 'arktype'."
    )
    assert re.search(r"\btype\.fn\s*\(", source), (
        "src/emit.ts must build the validated function using `type.fn(...)` "
        "so the parameter list is validated as a tuple."
    )
