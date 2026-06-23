import json
import os
import re
import subprocess

PROJECT_DIR = "/home/user/myproject"
VALIDATOR_PATH = os.path.join(PROJECT_DIR, "src", "validator.ts")
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


# ---------------------------------------------------------------------------
# Behavioural tests (Criteria 1-5)
# ---------------------------------------------------------------------------


def test_valid_https_call_resolves_with_ok_response():
    """Criterion 1: a valid call resolves and prints OK with the validated body."""
    payload = {
        "params": {
            "url": "https://example.com/data",
            "timeoutMs": 25,
            "retries": 2,
        }
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code for a valid call: "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}"
    )

    lines = _stdout_lines(result.stdout)
    assert len(lines) == 1, (
        f"Expected exactly one non-empty stdout line, got: {lines!r} "
        f"(stderr={result.stderr!r})"
    )
    assert lines[0].startswith("OK "), (
        f"Expected stdout to start with 'OK ', got: {lines[0]!r}"
    )
    json_part = lines[0][len("OK ") :].strip()
    try:
        payload_out = json.loads(json_part)
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"Stdout after 'OK ' is not valid JSON: {json_part!r} (error: {exc})"
        )
    assert payload_out == {"status": 200, "body": "ok"}, (
        f"Expected resolved payload to equal {{'status':200,'body':'ok'}}, "
        f"got: {payload_out!r}"
    )


def test_http_url_is_accepted_by_string_url_keyword():
    """Criterion 2: arktype's string.url keyword accepts http:// URLs (not only https)."""
    payload = {
        "params": {
            "url": "http://localhost:8080/health",
            "timeoutMs": 10,
            "retries": 0,
        }
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("OK "), (
        f"Expected stdout to start with 'OK ' for http URL, got: {result.stdout!r}"
    )
    json_part = lines[0][len("OK ") :].strip()
    payload_out = json.loads(json_part)
    assert payload_out == {"status": 200, "body": "ok"}, (
        f"Expected resolved payload to equal {{'status':200,'body':'ok'}}, "
        f"got: {payload_out!r}"
    )


def test_malformed_url_is_rejected():
    """Criterion 3: url='not-a-url' must be rejected at the validation boundary."""
    payload = {
        "params": {
            "url": "not-a-url",
            "timeoutMs": 25,
            "retries": 2,
        }
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("ERR "), (
        f"Expected stdout to start with 'ERR ' for malformed url, got: "
        f"{result.stdout!r}"
    )
    assert len(lines[0]) > len("ERR "), (
        f"Expected a non-empty error message after 'ERR ', got: {lines[0]!r}"
    )


def test_timeout_zero_is_rejected():
    """Criterion 4: timeoutMs=0 violates the > 0 lower bound."""
    payload = {
        "params": {
            "url": "https://example.com/data",
            "timeoutMs": 0,
            "retries": 2,
        }
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("ERR "), (
        f"Expected stdout to start with 'ERR ' for timeoutMs=0, got: "
        f"{result.stdout!r}"
    )


def test_retries_six_is_rejected():
    """Criterion 5: retries=6 violates the inclusive [0,5] range."""
    payload = {
        "params": {
            "url": "https://example.com/data",
            "timeoutMs": 25,
            "retries": 6,
        }
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("ERR "), (
        f"Expected stdout to start with 'ERR ' for retries=6, got: "
        f"{result.stdout!r}"
    )


# ---------------------------------------------------------------------------
# Implementation-shape tests (Criterion 6)
# ---------------------------------------------------------------------------


def _read_validator_source() -> str:
    assert os.path.isfile(VALIDATOR_PATH), (
        f"Expected validator module at {VALIDATOR_PATH}."
    )
    with open(VALIDATOR_PATH, encoding="utf-8") as f:
        return f.read()


def test_validator_exports_fetch_with_timeout():
    """Criterion 6 (part 1): src/validator.ts exports `fetchWithTimeout`."""
    source = _read_validator_source()
    pattern = re.compile(
        r"export\s+(?:async\s+)?(?:function|const|let|var)\s+fetchWithTimeout\b"
    )
    assert pattern.search(source), (
        "src/validator.ts must export a `fetchWithTimeout` symbol "
        "(e.g. `export const fetchWithTimeout` or "
        "`export function fetchWithTimeout`)."
    )


def test_validator_uses_type_fn():
    """Criterion 6 (part 2): the wrapper is built via arktype's `type.fn`."""
    source = _read_validator_source()
    assert re.search(r"from\s+['\"]arktype['\"]", source), (
        "src/validator.ts must import from 'arktype'."
    )
    assert "type.fn" in source, (
        "src/validator.ts must construct the wrapper with arktype's `type.fn`."
    )


def test_validator_models_promise_return():
    """Criterion 6 (part 3): the validator source models a Promise return type."""
    source = _read_validator_source()
    assert "Promise<" in source, (
        "src/validator.ts must model the return value as a Promise (e.g. "
        "`Promise<{ status: number; body: string }>`) so the resolved-value "
        "shape is explicitly declared."
    )


def test_cli_entrypoint_exists():
    """Sanity: the CLI entrypoint required by the acceptance criteria exists."""
    assert os.path.isfile(CLI_PATH), (
        f"Expected CLI entrypoint at {CLI_PATH}."
    )
