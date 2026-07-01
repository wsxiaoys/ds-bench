import os
import re
import subprocess
import json
import pytest

PROJECT_DIR = "/home/user/project"
RUN_ID_FILE = "/logs/artifacts/run-id"

# Convex table names may only contain letters, digits, and underscores, must
# start with a letter, and must be at most 64 characters long.
MAX_TABLE_NAME_LEN = 64
TABLE_PREFIX = "tasks_"


def _read_run_id():
    assert os.path.isfile(RUN_ID_FILE), (
        f"Run id file {RUN_ID_FILE} does not exist; cannot derive table name."
    )
    with open(RUN_ID_FILE, "r") as f:
        run_id = f.read().strip()
    assert run_id, f"Run id file {RUN_ID_FILE} is empty."
    return run_id


def _expected_table_name():
    """Derive the run-scoped table name the same way the solution must.

    Replace any non-alphanumeric characters with underscores and truncate so the
    final `tasks_<suffix>` name stays within Convex's 64-character limit.
    """
    run_id = _read_run_id()
    suffix = re.sub(r"[^A-Za-z0-9]", "_", run_id)
    max_suffix_len = MAX_TABLE_NAME_LEN - len(TABLE_PREFIX)
    suffix = suffix[:max_suffix_len]
    return TABLE_PREFIX + suffix


@pytest.fixture(scope="session", autouse=True)
def deploy_convex():
    """
    Setup: Deploy the Convex backend.
    """
    # Install dependencies
    subprocess.run(["npm", "install"], cwd=PROJECT_DIR, check=True)
    # Deploy to Convex
    result = subprocess.run(["npx", "convex", "deploy"], cwd=PROJECT_DIR, capture_output=True, text=True)
    assert result.returncode == 0, f"Convex deployment failed:\n{result.stderr}\n{result.stdout}"


def test_schema_uses_run_scoped_table():
    """
    Verify the schema defines the run-scoped table `tasks_<suffix>` so that
    concurrent/repeated runs do not collide on shared data.
    """
    expected_table = _expected_table_name()
    assert len(expected_table) <= MAX_TABLE_NAME_LEN, (
        f"Derived table name {expected_table!r} exceeds the {MAX_TABLE_NAME_LEN} char limit."
    )

    schema_path = os.path.join(PROJECT_DIR, "convex", "schema.ts")
    assert os.path.isfile(schema_path), f"schema.ts not found in {PROJECT_DIR}/convex"
    with open(schema_path, "r") as f:
        schema_content = f.read()
    assert expected_table in schema_content, (
        f"schema.ts must define the run-scoped table {expected_table!r} to isolate run data."
    )


def test_action_fetch_and_save():
    """
    Verify that tasks:fetchAndSave action works and returns a valid ID.
    We will use a small Node.js script to call the Convex client.
    """
    test_script_path = os.path.join(PROJECT_DIR, "test_action.cjs")
    script_content = """
const { ConvexHttpClient } = require("convex/browser");

async function main() {
    const client = new ConvexHttpClient(process.env.CONVEX_URL);
    try {
        const result = await client.action("tasks:fetchAndSave");
        console.log(JSON.stringify({ success: true, id: result }));
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}
main();
"""
    with open(test_script_path, "w") as f:
        f.write(script_content)

    env = os.environ.copy()
    assert "CONVEX_URL" in env, "CONVEX_URL environment variable is missing"

    result = subprocess.run(["node", "test_action.cjs"], cwd=PROJECT_DIR, capture_output=True, text=True, env=env)
    assert result.returncode == 0, f"Failed to call action tasks:fetchAndSave:\n{result.stderr}"

    try:
        output = json.loads(result.stdout)
    except json.JSONDecodeError:
        pytest.fail(f"Invalid JSON output from test script: {result.stdout}")

    assert output.get("success") is True, "Action did not return success"
    assert output.get("id") is not None, "Action did not return an ID"
    assert isinstance(output.get("id"), str), "Returned ID should be a string"
