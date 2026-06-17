import json
import os
import re
import subprocess

PROJECT_DIR = "/home/user/myproject"
PIPELINE_PATH = os.path.join(PROJECT_DIR, "src", "pipeline.ts")
CLI_PATH = os.path.join(PROJECT_DIR, "cli.ts")

VALID_CSV = (
    "id,age,email,signupAt\n"
    "11111111-1111-4111-8111-111111111111,30,alice@example.com,2024-01-15T10:30:00.000Z\n"
    "22222222-2222-4222-8222-222222222222,45,bob@example.com,2023-06-20T08:15:00.000Z\n"
    "33333333-3333-4333-8333-333333333333,7,charlie@example.com,2025-12-31T23:59:59.000Z\n"
)

EXPECTED_RECORDS = [
    {
        "id": "11111111-1111-4111-8111-111111111111",
        "age": 30,
        "email": "alice@example.com",
        "signupAt": "2024-01-15T10:30:00.000Z",
    },
    {
        "id": "22222222-2222-4222-8222-222222222222",
        "age": 45,
        "email": "bob@example.com",
        "signupAt": "2023-06-20T08:15:00.000Z",
    },
    {
        "id": "33333333-3333-4333-8333-333333333333",
        "age": 7,
        "email": "charlie@example.com",
        "signupAt": "2025-12-31T23:59:59.000Z",
    },
]

ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")


def _run_cli(csv_payload: str) -> subprocess.CompletedProcess[str]:
    """Invoke the CLI by piping a raw CSV string through stdin."""
    return subprocess.run(
        ["npx", "--no-install", "tsx", "cli.ts"],
        input=csv_payload,
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=180,
    )


def _stdout_lines(stdout: str) -> list[str]:
    return [line for line in stdout.splitlines() if line.strip() != ""]


# ---------------------------------------------------------------------------
# Implementation-shape sanity checks
# ---------------------------------------------------------------------------


def test_cli_entrypoint_exists():
    assert os.path.isfile(CLI_PATH), (
        f"Expected CLI entrypoint at {CLI_PATH}."
    )


def test_pipeline_module_exists():
    assert os.path.isfile(PIPELINE_PATH), (
        f"Expected pipeline module at {PIPELINE_PATH}."
    )


# ---------------------------------------------------------------------------
# Behavioural tests (Criteria 1-9)
# ---------------------------------------------------------------------------


def test_criterion_1_valid_three_row_csv_accepted_with_parsed_dates():
    """Criterion 1: valid 3-row CSV accepted with parsed Dates."""
    result = _run_cli(VALID_CSV)
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
        f"Expected JSON array on the line after VALID, got: {lines!r}"
    )
    try:
        parsed = json.loads(lines[1])
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"Second stdout line is not valid JSON: {lines[1]!r} (error: {exc})"
        )
    assert isinstance(parsed, list), (
        f"Expected the parsed output to be a JSON array, got: {type(parsed).__name__}"
    )
    assert len(parsed) == len(EXPECTED_RECORDS), (
        f"Expected {len(EXPECTED_RECORDS)} records, got {len(parsed)}: {parsed!r}"
    )
    for actual, expected in zip(parsed, EXPECTED_RECORDS):
        assert actual == expected, (
            f"Record mismatch.\n  expected: {expected!r}\n  actual:   {actual!r}"
        )


def test_criterion_2_malformed_header_rejected():
    """Criterion 2: malformed header rejected."""
    payload = (
        "age,id,email,signupAt\n"
        "30,11111111-1111-4111-8111-111111111111,alice@example.com,"
        "2024-01-15T10:30:00.000Z\n"
    )
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for malformed header, got: "
        f"{result.stdout!r}"
    )


def test_criterion_3_bad_uuid_rejected():
    """Criterion 3: bad uuid rejected."""
    payload = (
        "id,age,email,signupAt\n"
        "not-a-uuid,30,alice@example.com,2024-01-15T10:30:00.000Z\n"
    )
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for bad uuid, got: "
        f"{result.stdout!r}"
    )


def test_criterion_4_age_out_of_range_rejected():
    """Criterion 4: age=200 rejected (above the inclusive upper bound of 150)."""
    payload = (
        "id,age,email,signupAt\n"
        "11111111-1111-4111-8111-111111111111,200,alice@example.com,"
        "2024-01-15T10:30:00.000Z\n"
    )
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for age=200, got: "
        f"{result.stdout!r}"
    )


def test_criterion_5_bad_email_rejected():
    """Criterion 5: bad email rejected."""
    payload = (
        "id,age,email,signupAt\n"
        "11111111-1111-4111-8111-111111111111,30,not-an-email,"
        "2024-01-15T10:30:00.000Z\n"
    )
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for bad email, got: "
        f"{result.stdout!r}"
    )


def test_criterion_6_row_with_extra_column_rejected():
    """Criterion 6 (part a): row with extra column rejected."""
    payload = (
        "id,age,email,signupAt\n"
        "11111111-1111-4111-8111-111111111111,30,alice@example.com,"
        "2024-01-15T10:30:00.000Z,extra\n"
    )
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for extra column, got: "
        f"{result.stdout!r}"
    )


def test_criterion_6_row_with_missing_column_rejected():
    """Criterion 6 (part b): row with missing column rejected."""
    payload = (
        "id,age,email,signupAt\n"
        "11111111-1111-4111-8111-111111111111,30,alice@example.com\n"
    )
    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for missing column, got: "
        f"{result.stdout!r}"
    )


def test_criterion_7_empty_input_rejected():
    """Criterion 7: empty input rejected."""
    result = _run_cli("")
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for empty input, got: "
        f"{result.stdout!r}"
    )


def test_criterion_8_output_json_shape_matches_contract():
    """Criterion 8: output JSON shape exactly matches the contract."""
    result = _run_cli(VALID_CSV)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0] == "VALID", (
        f"Expected first non-empty stdout line to be 'VALID', got: {lines!r}"
    )
    parsed = json.loads(lines[1])
    assert isinstance(parsed, list), (
        f"Expected JSON array, got: {type(parsed).__name__}"
    )
    expected_keys = {"id", "age", "email", "signupAt"}
    for index, record in enumerate(parsed):
        assert isinstance(record, dict), (
            f"Record {index} is not a JSON object: {record!r}"
        )
        actual_keys = set(record.keys())
        assert actual_keys == expected_keys, (
            f"Record {index} has unexpected keys. "
            f"expected={expected_keys!r}, actual={actual_keys!r}"
        )
        assert isinstance(record["id"], str), (
            f"Record {index}: id must be a JSON string, got {type(record['id']).__name__}"
        )
        assert isinstance(record["age"], int) and not isinstance(record["age"], bool), (
            f"Record {index}: age must be a JSON integer number, got "
            f"{record['age']!r} ({type(record['age']).__name__})"
        )
        assert isinstance(record["email"], str), (
            f"Record {index}: email must be a JSON string, got "
            f"{type(record['email']).__name__}"
        )
        assert isinstance(record["signupAt"], str), (
            f"Record {index}: signupAt must be a JSON string, got "
            f"{type(record['signupAt']).__name__}"
        )
        assert ISO_DATE_RE.match(record["signupAt"]), (
            f"Record {index}: signupAt {record['signupAt']!r} does not match the "
            f"ISO-8601 contract regex {ISO_DATE_RE.pattern}"
        )
