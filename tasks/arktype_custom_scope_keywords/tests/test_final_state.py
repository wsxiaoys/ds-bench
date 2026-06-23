import json
import os
import re
import subprocess

PROJECT_DIR = "/home/user/myproject"
KEYWORDS_PATH = os.path.join(PROJECT_DIR, "src", "keywords.ts")
CLI_PATH = os.path.join(PROJECT_DIR, "cli.ts")


def _run_cli(payload: dict | list) -> subprocess.CompletedProcess[str]:
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


def test_valid_order_is_accepted():
    """Criterion 1: a valid Order validates and is returned unchanged."""
    payload = {
        "id": "order-2026-q2-001",
        "customerPhone": "+1 (415) 555-0132",
        "cardNumber": "4539578763621486",
        "total": 199.95,
    }

    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code for a valid order: "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}"
    )

    lines = _stdout_lines(result.stdout)
    assert lines and lines[0] == "VALID", (
        f"Expected first non-empty stdout line to be 'VALID', got: {lines!r} "
        f"(stderr={result.stderr!r})"
    )
    assert len(lines) >= 2, (
        f"Expected validated JSON object on the line after VALID, got: {lines!r}"
    )

    try:
        validated = json.loads(lines[1])
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"Second stdout line is not valid JSON: {lines[1]!r} (error: {exc})"
        )

    assert validated.get("id") == "order-2026-q2-001", (
        f"Validated id mismatch: {validated!r}"
    )
    assert validated.get("customerPhone") == "+1 (415) 555-0132", (
        f"Validated customerPhone mismatch: {validated!r}"
    )
    assert validated.get("cardNumber") == "4539578763621486", (
        f"Validated cardNumber mismatch: {validated!r}"
    )
    assert validated.get("total") == 199.95, (
        f"Validated total mismatch: {validated!r}"
    )


def test_invalid_luhn_is_rejected():
    """Criterion 2: a card number that fails the Luhn check is rejected."""
    payload = {
        "id": "order-2026-q2-001",
        "customerPhone": "+1 (415) 555-0132",
        "cardNumber": "4539578763621487",  # last digit flipped from 6 to 7
        "total": 199.95,
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for invalid Luhn, got: "
        f"{result.stdout!r}"
    )


def test_malformed_phone_is_rejected():
    """Criterion 3: a phone string that does not match the regex is rejected."""
    payload = {
        "id": "order-2026-q2-001",
        "customerPhone": "call me maybe",
        "cardNumber": "4539578763621486",
        "total": 199.95,
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for malformed phone, got: "
        f"{result.stdout!r}"
    )


def test_slug_with_leading_dash_is_rejected():
    """Criterion 4: a slug beginning with '-' is rejected."""
    payload = {
        "id": "-bad-slug",
        "customerPhone": "+1 (415) 555-0132",
        "cardNumber": "4539578763621486",
        "total": 199.95,
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for leading-dash slug, "
        f"got: {result.stdout!r}"
    )


def test_non_positive_total_is_rejected():
    """Criterion 5: a total of 0 (i.e. not > 0) is rejected."""
    payload = {
        "id": "order-2026-q2-001",
        "customerPhone": "+1 (415) 555-0132",
        "cardNumber": "4539578763621486",
        "total": 0,
    }
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for non-positive total, "
        f"got: {result.stdout!r}"
    )


# ---------------------------------------------------------------------------
# Implementation-shape test (Criterion 6)
# ---------------------------------------------------------------------------


def _read_keywords_source() -> str:
    assert os.path.isfile(KEYWORDS_PATH), (
        f"Expected keywords module at {KEYWORDS_PATH}."
    )
    with open(KEYWORDS_PATH, encoding="utf-8") as f:
        return f.read()


def test_keywords_source_uses_scope_and_narrow():
    """Criterion 6: src/keywords.ts uses scope(...) and a narrow predicate."""
    source = _read_keywords_source()
    assert re.search(r"from\s+['\"]arktype['\"]", source), (
        "src/keywords.ts must import from 'arktype'."
    )
    assert "scope(" in source, (
        "src/keywords.ts must call scope(...) to define the custom keywords."
    )
    assert re.search(r"\bnarrow\b|\.narrow\b", source), (
        "src/keywords.ts must use a narrow predicate (a `narrow(...)` call "
        "or a `.narrow(...)` fluent invocation)."
    )


def test_cli_entrypoint_exists():
    """Sanity: the CLI entrypoint required by the acceptance criteria exists."""
    assert os.path.isfile(CLI_PATH), (
        f"Expected CLI entrypoint at {CLI_PATH}."
    )
