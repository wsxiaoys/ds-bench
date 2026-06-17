import os
import subprocess
import json
import pytest

PROJECT_DIR = "/home/user/project"

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
