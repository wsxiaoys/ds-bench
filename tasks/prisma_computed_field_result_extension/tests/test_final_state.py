import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
RESULT_FILE = os.path.join(PROJECT_DIR, "computed_result.json")


def test_computed_script_runs():
    """Priority 1: Execute the agent's script."""
    result = subprocess.run(
        ["node", "computed.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node computed.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"computed_result.json must exist at {RESULT_FILE}"


def test_result_email():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("email") == "computed@example.com", (
        f"Result email must be 'computed@example.com'; got: {data.get('email')}"
    )


def test_result_has_full_label():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert "fullLabel" in data, (
        "Result must contain 'fullLabel' computed field"
    )


def test_full_label_value():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("fullLabel") == "Computed <computed@example.com>", (
        f"fullLabel must be 'Computed <computed@example.com>'; got: {data.get('fullLabel')}"
    )
