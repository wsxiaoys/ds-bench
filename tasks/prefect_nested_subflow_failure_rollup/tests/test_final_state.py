import os
import subprocess
import time

import pytest
import requests
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/nested_pipeline"
MAIN_SCRIPT = os.path.join(PROJECT_DIR, "main.py")
RUN_ID_FILE = "/logs/artifacts/run-id"

# Bind/connect over IPv4 explicitly. `localhost` can resolve to the IPv6 loopback
# (::1) on some systems, so a server listening on 127.0.0.1 would never be reached
# and the readiness check would hang for the full timeout.
HOST = "127.0.0.1"
PORT = 4200
BASE_URL = f"http://{HOST}:{PORT}"
API_URL = f"{BASE_URL}/api"
SERVER_LOG = "/tmp/prefect_server_final_state.log"


def _read_run_id():
    with open(RUN_ID_FILE, "r") as f:
        return f.read().strip()


@pytest.fixture(scope="session")
def run_id():
    assert os.path.isfile(RUN_ID_FILE), f"run-id file {RUN_ID_FILE} does not exist."
    rid = _read_run_id()
    assert rid, f"run-id read from {RUN_ID_FILE} is empty."
    return rid


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


def _print_server_log(tag):
    try:
        with open(SERVER_LOG, "r") as f:
            content = f.read()
    except OSError:
        content = "<no server log available>"
    print(f"============================== [{tag}] Prefect server log ==============================")
    print(content)
    print(f"============================== [{tag}] end server log ==============================")


@pytest.fixture(scope="session")
def prefect_server():
    """Start a local Prefect server (UI + API) on 127.0.0.1:4200."""
    env = {**os.environ, "PREFECT_API_URL": API_URL}
    log_file = open(SERVER_LOG, "w")
    proc = subprocess.Popen(
        ["prefect", "server", "start", "--host", HOST, "--port", str(PORT)],
        cwd=PROJECT_DIR,
        env=env,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        text=True,
    )

    ready = False
    deadline = time.time() + 240
    while time.time() < deadline:
        if proc.poll() is not None:
            break
        try:
            resp = requests.get(f"{API_URL}/health", timeout=5)
            if resp.status_code == 200:
                ready = True
                break
        except requests.RequestException:
            pass
        time.sleep(2)

    if not ready:
        _print_server_log("STARTUP-FAILED")
        proc.terminate()
        try:
            proc.wait(timeout=30)
        except subprocess.TimeoutExpired:
            proc.kill()
        log_file.close()
        raise RuntimeError("Prefect server did not become ready on 127.0.0.1:4200 within timeout.")

    _print_server_log("STARTED")

    yield API_URL

    proc.terminate()
    try:
        proc.wait(timeout=30)
    except subprocess.TimeoutExpired:
        proc.kill()
    log_file.close()
    _print_server_log("TEARDOWN")


@pytest.fixture(scope="session")
def driven_pipeline(prefect_server, run_id):
    """Execute the nested workflow hierarchy exactly once against the local server.

    The top-level workflow is expected to end in a failed terminal state, so a
    non-zero exit code from the driver is expected and intentionally ignored.
    """
    assert os.path.isfile(MAIN_SCRIPT), f"Driver script {MAIN_SCRIPT} does not exist."
    env = {**os.environ, "PREFECT_API_URL": API_URL}
    result = subprocess.run(
        ["python3", MAIN_SCRIPT],
        cwd=PROJECT_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=300,
    )
    print("============================== [DRIVER stdout] ==============================")
    print(result.stdout)
    print("============================== [DRIVER stderr] ==============================")
    print(result.stderr)
    # Give the server a brief moment to record all flow runs.
    time.sleep(5)
    return run_id


def test_top_level_failed_rollup(driven_pipeline, browser_verifier):
    rid = driven_pipeline
    reason = (
        "The top-level orchestration workflow must reach a failed terminal state because a "
        "deeply nested workflow on one of its branches failed and the failure rolled up to it."
    )
    truth = (
        f"Navigate to {BASE_URL}. In the Prefect UI, locate the flow run for the flow named "
        f"'orders-pipeline-{rid}' and open its flow run detail page. Verify that this top-level "
        f"flow run's terminal state is 'Failed'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_top_level_failed_rollup",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_nested_hierarchy_present(driven_pipeline, browser_verifier):
    rid = driven_pipeline
    reason = (
        "The top-level flow run must display a three-level nested subflow hierarchy: two child "
        "workflows, and under the billing branch a grandchild workflow."
    )
    truth = (
        f"Navigate to {BASE_URL}. Open the flow run for the flow named 'orders-pipeline-{rid}'. "
        f"Verify that its nested subflow structure is visible and contains the child flow run "
        f"'inventory-sync-{rid}' and the child flow run 'billing-rollup-{rid}', and that under "
        f"'billing-rollup-{rid}' there is a nested grandchild flow run 'charge-settlement-{rid}'. "
        f"This confirms the hierarchy is exactly three levels deep along the billing branch."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_nested_hierarchy_present",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_sibling_branch_completed(driven_pipeline, browser_verifier):
    rid = driven_pipeline
    reason = (
        "The sibling child workflow that is not on the failing branch must run to a successful "
        "terminal state, independent of the failing branch."
    )
    truth = (
        f"Navigate to {BASE_URL}. Locate the flow run for the flow named 'inventory-sync-{rid}' "
        f"(a child of 'orders-pipeline-{rid}') and verify that its terminal state is 'Completed'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_sibling_branch_completed",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_failing_branch_failed(driven_pipeline, browser_verifier):
    rid = driven_pipeline
    reason = (
        "The level-2 workflow on the failing branch must reach a failed terminal state because "
        "its grandchild workflow failed and rolled up to it."
    )
    truth = (
        f"Navigate to {BASE_URL}. Locate the flow run for the flow named 'billing-rollup-{rid}' "
        f"(a child of 'orders-pipeline-{rid}') and verify that its terminal state is 'Failed'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_failing_branch_failed",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_grandchild_deterministic_failure(driven_pipeline, browser_verifier):
    rid = driven_pipeline
    reason = (
        "The deepest (level-3) grandchild workflow must deterministically fail every time it runs."
    )
    truth = (
        f"Navigate to {BASE_URL}. Locate the grandchild flow run for the flow named "
        f"'charge-settlement-{rid}' (nested under 'billing-rollup-{rid}') and verify that its "
        f"terminal state is 'Failed'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_grandchild_deterministic_failure",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
