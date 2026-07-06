import os
import subprocess
import json
import pytest

PROJECT_DIR = "/home/user/project"

def extract_json_from_output(output):
    output = output.strip()
    start = output.find('{')
    end = output.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(output[start:end+1])
        except json.JSONDecodeError:
            pass
    try:
        lines = output.split('\n')
        return json.loads(lines[-1])
    except Exception as e:
        raise ValueError(f"Could not parse output as JSON: {output}") from e

@pytest.fixture(scope="session", autouse=True)
def deploy_convex():
    """Run npm install and deploy Convex before running tests."""
    # Ensure dependencies are installed
    subprocess.run(["npm", "install"], cwd=PROJECT_DIR, check=True)

    # Deploy Convex
    # CONVEX_DEPLOY_KEY must be present in the environment
    deploy_result = subprocess.run(
        ["npx", "convex", "deploy"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert deploy_result.returncode == 0, f"Convex deployment failed: {deploy_result.stderr}\n{deploy_result.stdout}"

def test_pagination():
    run_id = open("/logs/artifacts/run-id").read().strip()

    # 1. Insert 5 messages
    for i in range(1, 6):
        insert_args = json.dumps({
            "text": f"Message {i}",
            "runId": run_id
        })
        result = subprocess.run(
            ["npx", "convex", "run", "messages:insert", insert_args],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True
        )
        assert result.returncode == 0, f"Failed to insert message {i}: {result.stderr}"

    # 2. List First Page
    list_args_1 = json.dumps({
        "runId": run_id,
        "paginationOpts": {"numItems": 2, "cursor": None}
    })
    result_1 = subprocess.run(
        ["npx", "convex", "run", "messages:list", list_args_1],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert result_1.returncode == 0, f"Failed to list first page: {result_1.stderr}"

    # The output might have logs before the JSON result, but typically the last line is the JSON or we can parse it.
    # To handle potential CLI output formatting, we can extract the JSON part or assume the output is valid JSON.
    # Convex CLI output for `run` is usually just the return value JSON stringified.
    try:
        page_1 = extract_json_from_output(result_1.stdout)
    except Exception:
        pytest.fail(f"Could not parse first page output as JSON: {result_1.stdout}")

    assert len(page_1.get("page", [])) == 2, f"Expected 2 items in first page, got: {len(page_1.get('page', []))}"
    assert page_1.get("isDone") is False, "Expected isDone to be False for first page"
    cursor_1 = page_1.get("continueCursor")
    assert cursor_1, "Expected continueCursor to be present in first page"

    # 3. List Second Page
    list_args_2 = json.dumps({
        "runId": run_id,
        "paginationOpts": {"numItems": 2, "cursor": cursor_1}
    })
    result_2 = subprocess.run(
        ["npx", "convex", "run", "messages:list", list_args_2],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert result_2.returncode == 0, f"Failed to list second page: {result_2.stderr}"

    try:
        page_2 = extract_json_from_output(result_2.stdout)
    except Exception:
        pytest.fail(f"Could not parse second page output as JSON: {result_2.stdout}")

    assert len(page_2.get("page", [])) == 2, f"Expected 2 items in second page, got: {len(page_2.get('page', []))}"
    assert page_2.get("isDone") is False, "Expected isDone to be False for second page"
    cursor_2 = page_2.get("continueCursor")
    assert cursor_2, "Expected continueCursor to be present in second page"

    # 4. List Final Page
    list_args_3 = json.dumps({
        "runId": run_id,
        "paginationOpts": {"numItems": 2, "cursor": cursor_2}
    })
    result_3 = subprocess.run(
        ["npx", "convex", "run", "messages:list", list_args_3],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert result_3.returncode == 0, f"Failed to list final page: {result_3.stderr}"

    try:
        page_3 = extract_json_from_output(result_3.stdout)
    except Exception:
        pytest.fail(f"Could not parse final page output as JSON: {result_3.stdout}")

    assert len(page_3.get("page", [])) == 1, f"Expected 1 item in final page, got: {len(page_3.get('page', []))}"
    assert page_3.get("isDone") is True, "Expected isDone to be True for final page"
