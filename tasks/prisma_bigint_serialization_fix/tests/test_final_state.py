import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
RESULT_FILE = os.path.join(PROJECT_DIR, "rawcount_result.json")


def test_rawcount_script_runs_without_error():
    """Priority 1: Fixed script must exit 0 with no BigInt error."""
    result = subprocess.run(
        ["node", "rawcount.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, (
        f"node rawcount.js must exit 0 after fix; stderr={result.stderr.strip()}"
    )
    combined = result.stdout + result.stderr
    assert "BigInt" not in combined and "bigint" not in combined.lower(), (
        f"No BigInt error must appear after fix; got: {combined!r}"
    )


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"rawcount_result.json must exist at {RESULT_FILE}"


def test_result_is_valid_json():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert isinstance(data, list), f"rawcount_result.json must be a JSON array; got {type(data)}"


def test_result_count_is_three():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert len(data) >= 1, "Result array must have at least one row"
    row = data[0]
    cnt = row.get("cnt", row.get("COUNT(*)", None))
    assert cnt == 3 or str(cnt) == "3", (
        f"Count must equal 3; got: {cnt} (type: {type(cnt).__name__})"
    )
