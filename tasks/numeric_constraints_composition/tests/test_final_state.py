import json
import os
import re
import subprocess

PROJECT_DIR = "/home/user/myproject"
VALIDATOR_PATH = os.path.join(PROJECT_DIR, "src", "validator.ts")
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


def _valid_base_payload() -> dict:
    return {
        "percent": 25,
        "amount": 99.99,
        "validityDays": 30,
        "appliesTo": "cart",
    }


def _expect_invalid(payload: dict, label: str) -> None:
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"[{label}] CLI exited with non-zero code: "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"[{label}] Expected stdout to start with 'INVALID:', got: "
        f"{result.stdout!r} (stderr={result.stderr!r})"
    )


# ---------------------------------------------------------------------------
# Behavioural tests
# ---------------------------------------------------------------------------


def test_criterion_1_valid_discount_is_accepted():
    """Criterion 1: percent=25, amount=99.99, validityDays=30, appliesTo='cart'
    must validate."""
    payload = _valid_base_payload()
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code for valid discount: "
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

    assert validated.get("percent") == 25, f"percent mismatch: {validated!r}"
    assert validated.get("amount") == 99.99, f"amount mismatch: {validated!r}"
    assert validated.get("validityDays") == 30, (
        f"validityDays mismatch: {validated!r}"
    )
    assert validated.get("appliesTo") == "cart", (
        f"appliesTo mismatch: {validated!r}"
    )


def test_criterion_2_percent_out_of_range_is_rejected():
    """Criterion 2: percent=100 must be rejected."""
    payload = _valid_base_payload()
    payload["percent"] = 100
    _expect_invalid(payload, "percent=100")


def test_criterion_3_percent_not_divisible_by_5_is_rejected():
    """Criterion 3: percent=7 must be rejected."""
    payload = _valid_base_payload()
    payload["percent"] = 7
    _expect_invalid(payload, "percent=7")


def test_criterion_4_amount_at_excluded_upper_boundary_is_rejected():
    """Criterion 4: amount=10000 must be rejected (boundary excluded)."""
    payload = _valid_base_payload()
    payload["amount"] = 10000
    _expect_invalid(payload, "amount=10000")


def test_criterion_5_amount_with_too_many_decimals_is_rejected():
    """Criterion 5: amount=1.234 must be rejected (>2 decimal places)."""
    payload = _valid_base_payload()
    payload["amount"] = 1.234
    _expect_invalid(payload, "amount=1.234")


def test_criterion_6a_validity_days_zero_is_rejected():
    """Criterion 6: validityDays=0 must be rejected."""
    payload = _valid_base_payload()
    payload["validityDays"] = 0
    _expect_invalid(payload, "validityDays=0")


def test_criterion_6b_validity_days_366_is_rejected():
    """Criterion 6: validityDays=366 must be rejected."""
    payload = _valid_base_payload()
    payload["validityDays"] = 366
    _expect_invalid(payload, "validityDays=366")


def test_criterion_7_applies_to_invalid_literal_is_rejected():
    """Criterion 7: appliesTo='other' must be rejected."""
    payload = _valid_base_payload()
    payload["appliesTo"] = "other"
    _expect_invalid(payload, "appliesTo='other'")


# ---------------------------------------------------------------------------
# Implementation-shape tests (Criterion 8)
# ---------------------------------------------------------------------------


def _read_validator_source() -> str:
    assert os.path.isfile(VALIDATOR_PATH), (
        f"Expected validator module at {VALIDATOR_PATH}."
    )
    with open(VALIDATOR_PATH, encoding="utf-8") as f:
        return f.read()


def test_validator_imports_from_arktype():
    source = _read_validator_source()
    assert re.search(r"from\s+['\"]arktype['\"]", source), (
        "src/validator.ts must import from 'arktype'."
    )


def test_validator_exports_validate_discount():
    source = _read_validator_source()
    pattern = re.compile(
        r"export\s+(?:async\s+)?(?:function|const|let|var)\s+validateDiscount\b"
    )
    assert pattern.search(source), (
        "src/validator.ts must export a `validateDiscount` symbol."
    )


def test_validator_contains_range_expression():
    """Criterion 8 (part 1): source contains a `1 <= ... <= 99` range expression."""
    source = _read_validator_source()
    assert re.search(r"\b1\s*<=\s*[A-Za-z_][A-Za-z0-9_]*\s*<=\s*99\b", source), (
        "src/validator.ts must contain a string-embedded numeric range "
        "expression like `1 <= number <= 99` or `1<=percent<=99`."
    )


def test_validator_contains_divisibility_by_5():
    """Criterion 8 (part 2): source contains a `% 5` divisibility constraint."""
    source = _read_validator_source()
    assert re.search(r"%\s*5\b", source), (
        "src/validator.ts must contain a `% 5` divisibility constraint "
        "(ArkType `number%5` syntax)."
    )


def test_validator_uses_narrow_predicate():
    """The decimal-place check must be implemented via ArkType's narrow API."""
    source = _read_validator_source()
    assert re.search(r"\.narrow\s*\(", source), (
        "src/validator.ts must use ArkType's `.narrow(...)` predicate API "
        "to implement the decimal-place check on `amount`."
    )


def test_cli_entrypoint_exists():
    assert os.path.isfile(CLI_PATH), (
        f"Expected CLI entrypoint at {CLI_PATH}."
    )
