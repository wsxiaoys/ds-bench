import os
import subprocess
import time
import json
import pytest
import signal

PROJECT_DIR = "/home/user/project"
FLOW_FILE = os.path.join(PROJECT_DIR, "flow.py")

@pytest.fixture(scope="module")
def setup_environment():
    env = os.environ.copy()
    env["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"

    # Start Prefect server
    server_process = subprocess.Popen(
        ["prefect", "server", "start"],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )
    time.sleep(10)  # Wait for server to be ready

    # Start the flow
    flow_process = subprocess.Popen(
        ["python3", "flow.py"],
        cwd=PROJECT_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )
    time.sleep(10)  # Wait for deployment to be served

    yield env

    # Teardown
    try:
        os.killpg(os.getpgid(flow_process.pid), signal.SIGTERM)
    except Exception:
        pass
    try:
        os.killpg(os.getpgid(server_process.pid), signal.SIGTERM)
    except Exception:
        pass

def test_flow_file_exists():
    """Priority 3 fallback: basic file existence check."""
    assert os.path.isfile(FLOW_FILE), f"flow.py not found at {FLOW_FILE}"

def test_event_trigger_and_automation(setup_environment):
    """Priority 1: Use Prefect CLI to emit an event and verify the flow run was triggered."""
    env = setup_environment

    # Emit the event
    emit_result = subprocess.run(
        ["prefect", "events", "emit", "--event", "custom.webhook.received", "--resource", "prefect.resource.id=my.webhook.resource"],
        env=env,
        capture_output=True, text=True
    )
    assert emit_result.returncode == 0, f"'prefect events emit' failed: {emit_result.stderr}"

    # Wait for the automation to trigger the flow run
    time.sleep(10)

    # List flow runs
    ls_result = subprocess.run(
        ["prefect", "flow-run", "ls", "--output", "json"],
        env=env,
        capture_output=True, text=True
    )
    assert ls_result.returncode == 0, f"'prefect flow-run ls' failed: {ls_result.stderr}"

    runs = json.loads(ls_result.stdout)
    
    automation_runs = [run for run in runs if run.get("created_by") and run["created_by"].get("type") == "AUTOMATION"]
    assert len(automation_runs) > 0, "No flow runs were triggered by an AUTOMATION."
    
    # Check if the file contains the required triggers as a fallback
    with open(FLOW_FILE, "r") as f:
        content = f.read()
    assert "DeploymentEventTrigger" in content, "Expected 'DeploymentEventTrigger' in flow.py"
    assert "custom.webhook.received" in content, "Expected 'custom.webhook.received' event in flow.py"
    assert "my.webhook.resource" in content, "Expected 'my.webhook.resource' resource in flow.py"
