import os
import socket
import subprocess
import sys
import time

import pytest
import requests
from pochi_verifier import PochiVerifier

HOST = "127.0.0.1"
PORT = 4200
API_URL = f"http://{HOST}:{PORT}/api"
UI_URL = f"http://{HOST}:{PORT}"
RUN_ID_PATH = "/logs/artifacts/run-id"


def _read_run_id():
    with open(RUN_ID_PATH) as f:
        return f.read().strip()


def _port_open(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(2)
        return s.connect_ex((host, port)) == 0


def _api_ready():
    try:
        resp = requests.get(f"{API_URL}/health", timeout=5)
        return resp.status_code == 200
    except requests.RequestException:
        return False


def _emit_event(event_name, resource_id, env):
    """Emit a single custom event onto the local server in its own process.

    A short-lived interpreter is used so Prefect's events worker flushes the
    buffered event to the API on interpreter exit.
    """
    code = (
        "import sys\n"
        "from prefect.events import emit_event\n"
        "emit_event(event=sys.argv[1], resource={'prefect.resource.id': sys.argv[2]})\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", code, event_name, resource_id],
        capture_output=True,
        text=True,
        env=env,
    )
    print(f"[emit {event_name}] rc={result.returncode}\nstdout={result.stdout}\nstderr={result.stderr}")
    assert result.returncode == 0, f"Failed to emit event {event_name}: {result.stderr}"


def _deployment_id(name, env):
    resp = requests.post(
        f"{API_URL}/deployments/filter",
        json={"deployments": {"name": {"like_": name}}},
        timeout=15,
    )
    resp.raise_for_status()
    for dep in resp.json():
        if dep.get("name") == name:
            return dep.get("id")
    return None


def _flow_run_count_for_deployment(deployment_id):
    resp = requests.post(
        f"{API_URL}/flow_runs/filter",
        json={"flow_runs": {"deployment_id": {"any_": [deployment_id]}}},
        timeout=15,
    )
    resp.raise_for_status()
    return len(resp.json())


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def prefect_env():
    """Ensure the local Prefect server is up, then drive the gated condition.

    This synchronization runs entirely as SETUP: it starts (or reuses) the
    local server, emits the two ordered custom events, and waits until the
    automation-produced flow run is present. All graded assertions are done
    later via the browser verifier.
    """
    run_id = _read_run_id()
    env = os.environ.copy()
    env["PREFECT_API_URL"] = API_URL

    server_proc = None
    if not _api_ready():
        server_proc = subprocess.Popen(
            ["prefect", "server", "start", "--host", HOST, "--port", str(PORT)],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        deadline = time.time() + 120
        while time.time() < deadline:
            if _api_ready():
                break
            time.sleep(2)
        assert _api_ready(), "Local Prefect server did not become ready on 127.0.0.1:4200."

    assert _port_open(HOST, PORT), "Prefect UI/API port 4200 is not open."

    deployment_name = f"guarded-export-{run_id}"
    resource_id = f"zealt.export.{run_id}"
    staged_event = f"zealt.export.staged.{run_id}"
    approved_event = f"zealt.export.approved.{run_id}"

    # The deployment must already exist (it is the solution's artifact).
    dep_id = None
    deadline = time.time() + 30
    while time.time() < deadline:
        dep_id = _deployment_id(deployment_name, env)
        if dep_id:
            break
        time.sleep(2)
    assert dep_id, f"Deployment '{deployment_name}' was not found on the local server."

    runs_before = _flow_run_count_for_deployment(dep_id)

    # Drive the gated condition: first event, then (strictly later) the second.
    _emit_event(staged_event, resource_id, env)
    time.sleep(5)
    _emit_event(approved_event, resource_id, env)

    # Wait for the automation to fire and create a new flow run for the deployment.
    fired = False
    deadline = time.time() + 120
    while time.time() < deadline:
        try:
            if _flow_run_count_for_deployment(dep_id) > runs_before:
                fired = True
                break
        except requests.RequestException:
            pass
        time.sleep(3)
    print(f"[prefect_env] deployment={deployment_name} runs_before={runs_before} fired={fired}")

    yield {
        "run_id": run_id,
        "deployment_name": deployment_name,
        "automation_name": f"seq-guard-automation-{run_id}",
        "staged_event": staged_event,
        "approved_event": approved_event,
    }

    if server_proc is not None:
        server_proc.terminate()
        try:
            server_proc.wait(timeout=20)
        except subprocess.TimeoutExpired:
            server_proc.kill()


def test_automation_listed_with_composite_trigger(prefect_env, browser_verifier):
    automation_name = prefect_env["automation_name"]
    staged = prefect_env["staged_event"]
    approved = prefect_env["approved_event"]
    deployment_name = prefect_env["deployment_name"]

    reason = (
        "The solution must create a single automation whose trigger is gated on two "
        "distinct custom events (a composite/ordered trigger), and whose action runs a "
        "specific local deployment."
    )
    truth = (
        f"Navigate to {UI_URL}/automations. Verify that an automation named exactly "
        f"'{automation_name}' is listed. Open that automation's detail page. Verify that "
        f"its trigger is a composite/multi-event trigger that references BOTH custom event "
        f"names '{staged}' and '{approved}' (it must depend on two events, not a single "
        f"event). Verify that the automation's action starts a run of the deployment named "
        f"'{deployment_name}'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_automation_listed_with_composite_trigger",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_deployment_listed(prefect_env, browser_verifier):
    deployment_name = prefect_env["deployment_name"]

    reason = "The solution must register a runnable deployment that the automation can launch."
    truth = (
        f"Navigate to {UI_URL}/deployments. Verify that a deployment named exactly "
        f"'{deployment_name}' is listed on the Deployments page."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_deployment_listed",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_automation_fired_created_flow_run(prefect_env, browser_verifier):
    deployment_name = prefect_env["deployment_name"]

    reason = (
        "After the two required events are observed in order, the automation must fire and "
        "its action must create a new flow run of the target deployment, which must be "
        "visible in the UI."
    )
    truth = (
        f"Navigate to {UI_URL}/deployments and open the deployment named exactly "
        f"'{deployment_name}'. View its flow runs. Verify that at least one flow run exists "
        f"for this deployment (this run was created automatically when the automation fired "
        f"after both required events were observed)."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_automation_fired_created_flow_run",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
