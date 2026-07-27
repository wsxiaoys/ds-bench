import json
import os
import socket
import subprocess
import time
import urllib.error
import urllib.request

import pytest
from pochi_verifier import PochiVerifier  # type: ignore[import-not-found]

# Bind/connect over IPv4 explicitly. `localhost` can resolve to the IPv6 loopback
# (::1) while the Prefect server listens on the IPv4 loopback only, which would make
# readiness checks hang for the full timeout and raise confusing TimeoutErrors.
HOST = "127.0.0.1"
PORT = 4200
BASE_URL = f"http://{HOST}:{PORT}"
API_URL = f"{BASE_URL}/api"

PROJECT_DIR = "/home/user/concurrency_guard"
ENTRYPOINT = ["python3", "run.py"]

RUN_ID_PATH = "/logs/artifacts/run-id"

EXPECTED_UNITS = 12
TAG_SLOTS = 1
GCL_SLOTS = 3

TERMINAL_STATE_TYPES = {"COMPLETED", "FAILED", "CRASHED", "CANCELLED"}


def _read_run_id():
    with open(RUN_ID_PATH) as f:
        run_id = f.read().strip()
    assert run_id, f"run-id file {RUN_ID_PATH} is empty."
    return run_id


def _api_healthy(timeout=5):
    try:
        with urllib.request.urlopen(f"{API_URL}/health", timeout=timeout) as resp:
            return resp.status == 200
    except (urllib.error.URLError, OSError):
        return False


def _port_open():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((HOST, PORT)) == 0


def _post_filter(path, body):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{API_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _get_flow_id(flow_name):
    flows = _post_filter(
        "/flows/filter",
        {"flows": {"name": {"any_": [flow_name]}}, "limit": 5},
    )
    if not flows:
        return None
    return flows[0]["id"]


def _flow_runs_for_flow(flow_id):
    return _post_filter(
        "/flow_runs/filter",
        {"flows": {"id": {"any_": [flow_id]}}, "limit": 200},
    )


@pytest.fixture(scope="session")
def run_id():
    return _read_run_id()


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def prefect_server():
    """Ensure a local Prefect server is reachable at 127.0.0.1:4200.

    The environment entrypoint normally starts the server already; if it is not
    reachable, start one here and tear it down afterwards.
    """
    proc = None
    if not _api_healthy():
        env = os.environ.copy()
        env["PREFECT_API_URL"] = API_URL
        proc = subprocess.Popen(
            ["prefect", "server", "start", "--host", HOST, "--port", str(PORT)],
            cwd="/home/user",
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        deadline = time.time() + 180
        while time.time() < deadline:
            if _api_healthy():
                break
            time.sleep(3)
        else:
            raise RuntimeError("Prefect server did not become healthy in time.")

    assert _api_healthy(), f"Prefect server API not reachable at {API_URL}."
    yield API_URL

    if proc is not None:
        proc.terminate()
        try:
            proc.wait(timeout=30)
        except subprocess.TimeoutExpired:
            proc.kill()


@pytest.fixture(scope="session")
def workload(prefect_server, run_id):
    """Run the agent's workload exactly once and wait until all units settle.

    Starting the server and running the concurrent workload are part of test
    setup; every graded assertion is performed through the browser.
    """
    flow_name = f"guarded_pipeline_{run_id}"

    env = os.environ.copy()
    env["PREFECT_API_URL"] = API_URL

    print(f"===== [WORKLOAD] Running {' '.join(ENTRYPOINT)} in {PROJECT_DIR} =====")
    result = subprocess.run(
        ENTRYPOINT,
        cwd=PROJECT_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=1200,
    )
    print("----- workload stdout -----")
    print(result.stdout)
    print("----- workload stderr -----")
    print(result.stderr)
    print(f"----- workload return code: {result.returncode} -----")

    # Wait for the server to reflect all 12 units in terminal states so the UI is
    # stable before the browser assertions run.
    flow_id = None
    deadline = time.time() + 600
    while time.time() < deadline:
        flow_id = _get_flow_id(flow_name)
        if flow_id:
            runs = _flow_runs_for_flow(flow_id)
            terminal = [r for r in runs if r.get("state_type") in TERMINAL_STATE_TYPES]
            if len(terminal) >= EXPECTED_UNITS and len(terminal) == len(runs):
                print(f"[WORKLOAD] {len(runs)} runs of {flow_name} reached terminal states.")
                break
        time.sleep(5)

    return {"flow_name": flow_name, "flow_id": flow_id}


def test_global_concurrency_limit_visible_in_ui(workload, run_id, browser_verifier):
    """The global concurrency limit must exist in the UI with exactly 3 slots."""
    gcl_name = f"throughput-{run_id}"
    reason = (
        "The pipeline must be protected by a global concurrency limit that caps overall "
        "parallelism, and it must be registered on the local server and visible in the UI."
    )
    truth = (
        f"Open the Prefect UI at {BASE_URL}. Navigate to the Concurrency section (the "
        f"page listing concurrency limits, e.g. via {BASE_URL}/concurrency-limits or the "
        f"'Concurrency' item in the sidebar), and open the view that lists GLOBAL "
        f"concurrency limits. Verify that a global concurrency limit named exactly "
        f"'{gcl_name}' is listed, and that its configured concurrency limit / number of "
        f"slots is exactly {GCL_SLOTS}."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_global_concurrency_limit_visible_in_ui",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_tag_concurrency_limit_visible_in_ui(workload, run_id, browser_verifier):
    """The tag-based task-run concurrency limit must exist with exactly 1 slot."""
    tag = f"hotpath-{run_id}"
    reason = (
        "The hot resource's critical section must be strictly serialized by a task-run "
        "concurrency limit applied to a specific tag, registered on the local server and "
        "visible in the UI."
    )
    truth = (
        f"Open the Prefect UI at {BASE_URL}. Navigate to the Concurrency section (e.g. via "
        f"{BASE_URL}/concurrency-limits or the 'Concurrency' item in the sidebar), and open "
        f"the view that lists TASK RUN (tag-based) concurrency limits. Verify that there is "
        f"a task-run concurrency limit for the tag exactly '{tag}', and that its configured "
        f"concurrency limit / number of slots is exactly {TAG_SLOTS}."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_tag_concurrency_limit_visible_in_ui",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_all_units_completed_in_ui(workload, run_id, browser_verifier):
    """Exactly 12 flow runs of the guarded pipeline must all be Completed."""
    flow_name = f"guarded_pipeline_{run_id}"
    reason = (
        "Under the two combined concurrency controls, every one of the 12 concurrently "
        "launched units of work must finish successfully without deadlocking."
    )
    truth = (
        f"Open the Prefect UI at {BASE_URL}. Navigate to the Flow Runs view (the list of "
        f"flow runs, e.g. via {BASE_URL}/runs or the 'Runs' / 'Flow Runs' item in the "
        f"sidebar). Locate the flow runs belonging to the flow named exactly '{flow_name}' "
        f"(you may filter or search by this flow name). Verify that there are exactly "
        f"{EXPECTED_UNITS} such flow runs and that EVERY one of them is in the 'Completed' "
        f"state (shown green), with none in a Failed, Crashed, Cancelled, Running, Pending, "
        f"or Late state."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_all_units_completed_in_ui",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
