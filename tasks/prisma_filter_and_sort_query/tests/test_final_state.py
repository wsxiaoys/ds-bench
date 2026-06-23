import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
RESULT_FILE = os.path.join(PROJECT_DIR, "query_result.json")


def test_query_script_runs_successfully():
    """Priority 1: Execute the agent's query script."""
    result = subprocess.run(
        ["node", "query.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node query.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"query_result.json must exist at {RESULT_FILE}"


def test_result_is_list():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert isinstance(data, list), f"query_result.json must be a JSON array; got: {type(data)}"


def test_result_contains_exactly_two_users():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert len(data) == 2, (
        f"Query must return exactly 2 users (Alice and Aaron); got {len(data)}: {data}"
    )


def test_result_users_start_with_a():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    for user in data:
        assert user.get("name", "").startswith("A"), (
            f"All returned users must have name starting with 'A'; found: {user.get('name')}"
        )


def test_result_sorted_ascending():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    names = [u["name"] for u in data]
    assert names == sorted(names), (
        f"Users must be sorted by name ascending; got: {names}"
    )


def test_first_result_is_aaron():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data[0]["name"] == "Aaron", (
        f"First result must be Aaron (alphabetically before Alice); got: {data[0].get('name')}"
    )
