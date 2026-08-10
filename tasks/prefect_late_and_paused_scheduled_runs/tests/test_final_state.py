import json
import os
import subprocess
import time
import urllib.error
import urllib.request

import pytest
from pochi_verifier import PochiVerifier  # pyright: ignore[reportMissingImports]

PROJECT_DIR = "/home/user/scheduling_lab"
HOST = "127.0.0.1"
UI_URL = f"http://{HOST}:4200"
API_URL = f"http://{HOST}:4200/api"
RUN_ID_FILE = "/logs/artifacts/run-id"


def _read_run_id():
    with open(RUN_ID_FILE) as f:
        run_id = f.read().strip()
    assert run_id, f"run-id read from {RUN_ID_FILE} is empty."
    return run_id


def _api_post(path, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{API_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _wait_for_api():
    last_error = None
    for _ in range(60):
        try:
            with urllib.request.urlopen(f"{API_URL}/health", timeout=5) as resp:
                if resp.status == 200:
                    return
        except (urllib.error.URLError, OSError) as exc:
            last_error = exc
        time.sleep(2)
    pytest.fail(f"Prefect API at {API_URL} not reachable. Last error: {last_error}")


def _find_deployment_id(name):
    try:
        deployments = _api_post(
            "/deployments/filter",
            {"deployments": {"name": {"any_": [name]}}},
        )
    except (urllib.error.URLError, OSError):
        return None
    for dep in deployments:
        if dep.get("name") == name:
            return dep.get("id")
    return None


def _count_late_runs(deployment_id):
    runs = _api_post(
        "/flow_runs/filter",
        {
            "flow_runs": {
                "deployment_id": {"any_": [deployment_id]},
                "state": {"name": {"any_": ["Late"]}},
            }
        },
    )
    return len(runs)


@pytest.fixture(scope="session")
def run_id():
    return _read_run_id()


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def prepared_state(run_id):
    """Ensure the server is up, (re)apply the agent's reproducible setup, and wait
    until the active deployment has at least one Late run so the UI checks are
    deterministic. No worker/executor is started here."""
    _wait_for_api()

    setup_script = os.path.join(PROJECT_DIR, "setup.sh")
    assert os.path.isfile(setup_script), (
        f"Expected reproducible setup script at {setup_script}; it was not found."
    )
    result = subprocess.run(
        ["bash", "setup.sh"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=300,
    )
    print("setup.sh stdout:\n" + result.stdout)
    print("setup.sh stderr:\n" + result.stderr)
    assert result.returncode == 0, (
        f"'bash setup.sh' failed with code {result.returncode}: {result.stderr}"
    )

    active_name = f"pulse-active-{run_id}"

    deployment_id = None
    for _ in range(30):
        deployment_id = _find_deployment_id(active_name)
        if deployment_id:
            break
        time.sleep(2)
    assert deployment_id, (
        f"Deployment '{active_name}' was not found on the local Prefect server after setup."
    )

    late_seen = False
    for _ in range(90):
        try:
            if _count_late_runs(deployment_id) > 0:
                late_seen = True
                break
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(2)
    assert late_seen, (
        f"No flow run of '{active_name}' reached the Late state within the observation window."
    )
    return {"active_name": active_name, "paused_name": f"pulse-paused-{run_id}"}


def test_active_deployment_has_late_run(prepared_state, browser_verifier):
    active_name = prepared_state["active_name"]
    reason = (
        "An actively-scheduled deployment whose scheduled runs are not being executed "
        "must surface overdue runs in the Late state in the Prefect UI."
    )
    truth = (
        f"Navigate to {UI_URL}. Go to the Deployments page and open the deployment named "
        f"exactly '{active_name}' (or open the Runs / Flow Runs page and filter to this "
        f"deployment). Verify that at least one flow run belonging to '{active_name}' is shown "
        f"with a 'Late' state badge. Success requires seeing at least one Late run for this deployment."
    )
    verification = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_active_deployment_has_late_run",
    )
    assert verification.status == "pass", (
        f"Browser verification failed: {verification.reason}"
    )


def test_active_deployment_runs_not_executed(prepared_state, browser_verifier):
    active_name = prepared_state["active_name"]
    reason = (
        "Because nothing is executing the scheduled work, the active deployment's runs must "
        "remain in the scheduled lifecycle (Scheduled/Late) and must not have been run."
    )
    truth = (
        f"Navigate to {UI_URL}. Open the deployment named exactly '{active_name}' and inspect its "
        f"flow runs. Verify that its runs are only in Scheduled or Late states and that there are "
        f"NO runs in a Running or Completed state for this deployment. Success requires that no run "
        f"of '{active_name}' has progressed to Running or Completed."
    )
    verification = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_active_deployment_runs_not_executed",
    )
    assert verification.status == "pass", (
        f"Browser verification failed: {verification.reason}"
    )


def test_paused_deployment_schedule_inactive(prepared_state, browser_verifier):
    paused_name = prepared_state["paused_name"]
    reason = (
        "A deployment whose schedule has been switched off must be shown in the UI with an "
        "inactive/paused schedule."
    )
    truth = (
        f"Navigate to {UI_URL}. Go to the Deployments page and open the deployment named exactly "
        f"'{paused_name}'. Inspect its schedule(s). Verify that its schedule is displayed as paused "
        f"or inactive (the schedule toggle is off / the schedule status reads paused). Success "
        f"requires that the schedule for '{paused_name}' is not active."
    )
    verification = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_paused_deployment_schedule_inactive",
    )
    assert verification.status == "pass", (
        f"Browser verification failed: {verification.reason}"
    )


def test_paused_deployment_has_no_upcoming_runs(prepared_state, browser_verifier):
    paused_name = prepared_state["paused_name"]
    reason = (
        "A deployment with a paused schedule must have nothing queued ahead of it in the UI."
    )
    truth = (
        f"Navigate to {UI_URL}. Open the deployment named exactly '{paused_name}'. Look at its "
        f"upcoming / next scheduled runs. Verify that there are NO upcoming (future scheduled) runs "
        f"listed for this deployment. Success requires that the upcoming runs section for "
        f"'{paused_name}' is empty."
    )
    verification = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_paused_deployment_has_no_upcoming_runs",
    )
    assert verification.status == "pass", (
        f"Browser verification failed: {verification.reason}"
    )
