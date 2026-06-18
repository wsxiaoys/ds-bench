import os
import subprocess
import json
import pytest

PROJECT_DIR = "/home/user/convex-search"

def test_deploy_and_run_script():
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, "ZEALT_RUN_ID environment variable is not set."

    # Install dependencies
    install_result = subprocess.run(
        ["npm", "install"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert install_result.returncode == 0, f"npm install failed: {install_result.stderr}"

    # Deploy convex
    deploy_result = subprocess.run(
        ["npx", "convex", "deploy"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert deploy_result.returncode == 0, f"npx convex deploy failed: {deploy_result.stderr}"

    # Run test script
    run_result = subprocess.run(
        ["node", "test.js", "--run-id", run_id],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert run_result.returncode == 0, f"node test.js failed: {run_result.stderr}\nStdout: {run_result.stdout}"

    # Verify output
    try:
        output_json = json.loads(run_result.stdout)
    except json.JSONDecodeError:
        pytest.fail(f"Could not parse stdout as JSON. Stdout: {run_result.stdout}")

    assert isinstance(output_json, list), f"Expected output to be a JSON array. Got type: {type(output_json)}"
    assert len(output_json) == 2, f"Expected exactly 2 elements in the array, got {len(output_json)}."

    for item in output_json:
        assert "channelId" in item, f"Missing 'channelId' field in item: {item}"
        assert item["channelId"] == run_id, f"Expected channelId to be {run_id}, got {item['channelId']}"
        assert "body" in item, f"Missing 'body' field in item: {item}"
        assert "Hello" in item["body"], f"Expected 'Hello' in body, got {item['body']}"
