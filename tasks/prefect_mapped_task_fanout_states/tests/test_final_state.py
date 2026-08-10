import os
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier  # pyright: ignore[reportMissingImports]

PROJECT_DIR = "/home/user/mapped_fanout"
# Bind/connect over IPv4 explicitly. `localhost` can resolve to the IPv6 loopback
# (::1) on some systems, so the server may listen on ::1 only while an AF_INET
# socket to 127.0.0.1 never connects -> readiness checks would hang.
HOST = "127.0.0.1"
PORT = 4200
UI_URL = f"http://{HOST}:{PORT}"
API_URL = f"http://{HOST}:{PORT}/api"
RUN_ID_PATH = "/logs/artifacts/run-id"


def _read_run_id() -> str:
    assert os.path.isfile(RUN_ID_PATH), f"run-id file not found at {RUN_ID_PATH}."
    with open(RUN_ID_PATH) as f:
        run_id = f.read().strip()
    assert run_id, f"run-id file at {RUN_ID_PATH} is empty."
    return run_id


def _api_is_up() -> bool:
    try:
        resp = requests.get(f"{API_URL}/health", timeout=5)
        return resp.status_code == 200
    except requests.RequestException:
        return False


@pytest.fixture(scope="session")
def run_id() -> str:
    return _read_run_id()


@pytest.fixture(scope="session")
def flow_name(run_id: str) -> str:
    return f"mapped-fanout-{run_id}"


@pytest.fixture(scope="session")
def browser_verifier() -> PochiVerifier:
    return PochiVerifier()


@pytest.fixture(scope="session")
def prefect_server(xprocess):
    """Ensure a local Prefect server is reachable at http://127.0.0.1:4200.

    If a server is already running (e.g. started by the executor), reuse it.
    Otherwise start one with xprocess.
    """
    if _api_is_up():
        yield
        return

    class Starter(ProcessStarter):
        name = "prefect_server"
        args = ["prefect", "server", "start", "--host", HOST, "--port", str(PORT)]  # pyright: ignore[reportIncompatibleMethodOverride, reportAssignmentType]
        # CRITICAL: set env as a class attribute, never inside popen_kwargs.
        env = {**os.environ, "PREFECT_API_URL": API_URL}
        popen_kwargs = {
            "cwd": "/home/user",
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):  # pyright: ignore[reportIncompatibleMethodOverride]
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(f"{API_URL}/health", timeout=15)
                return resp.status_code == 200
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        try:
            with open(info.logpath, "r") as f:
                all_lines = f.readlines()
        except FileNotFoundError:
            all_lines = []
        new_lines = all_lines[printed_log_lines:]
        printed_log_lines = len(all_lines)
        print(f"===== [{tag}: Begin] {Starter.name} log =====")
        print("".join(new_lines))
        print(f"===== [{tag}: End] {Starter.name} log =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def flow_run(prefect_server):
    """Execute the executor's flow once so a flow run exists on the local server.

    The flow is expected to terminate in a Failed state, which may produce a
    non-zero exit code; that is expected and not asserted here.
    """
    assert os.path.isfile(os.path.join(PROJECT_DIR, "flow.py")), (
        f"Expected the executor's flow at {PROJECT_DIR}/flow.py; it was not found."
    )
    env = {**os.environ, "PREFECT_API_URL": API_URL}
    result = subprocess.run(
        ["python3", "flow.py"],
        cwd=PROJECT_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=600,
    )
    print("===== flow.py stdout =====")
    print(result.stdout)
    print("===== flow.py stderr =====")
    print(result.stderr)
    yield


def test_flow_run_exists_and_final_state_failed(flow_run, browser_verifier, flow_name):
    reason = (
        "The executor built a Prefect flow that fans one unit of work out across a "
        "collection of inputs; the flow must be registered on the local server and "
        "its flow run must end in a Failed aggregate state because part of the batch "
        "failed."
    )
    truth = (
        f"Open the Prefect UI at {UI_URL}. Navigate to the Flows page (or the Runs "
        f"page) and locate a flow whose name is exactly '{flow_name}'. Open its most "
        f"recent flow run. Verify the flow run exists and that its final (terminal) "
        f"state is 'Failed'. The state badge/label for this flow run must read "
        f"'Failed' (it must NOT be 'Completed', 'Crashed', 'Cancelled', or still "
        f"'Running')."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_flow_run_exists_and_final_state_failed",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_total_and_completed_child_task_runs(flow_run, browser_verifier, flow_name):
    reason = (
        "The flow dynamically fans a single unit of work out across exactly 20 inputs, "
        "each becoming its own concurrent child task run; the successful subset must "
        "be recorded as Completed child task runs in the flow run's task-runs listing."
    )
    truth = (
        f"Open the Prefect UI at {UI_URL}. Locate the flow named exactly "
        f"'{flow_name}' and open its most recent flow run. Inspect the list of child "
        f"task runs belonging to this flow run (e.g. the 'Task Runs' tab/section of "
        f"the flow-run detail page). Verify that the total number of child task runs "
        f"for this flow run is exactly 20. Then filter or count the task runs that are "
        f"in the 'Completed' state and verify that exactly 15 child task runs are in "
        f"the 'Completed' state."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_total_and_completed_child_task_runs",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_failed_child_task_runs(flow_run, browser_verifier, flow_name):
    reason = (
        "A deterministic subset of the fanned-out inputs must fail, and every failing "
        "input must still be recorded as a Failed child task run so the partial "
        "failure is fully observable in the UI."
    )
    truth = (
        f"Open the Prefect UI at {UI_URL}. Locate the flow named exactly "
        f"'{flow_name}' and open its most recent flow run. Inspect the list of child "
        f"task runs for this flow run and filter or count the task runs that are in "
        f"the 'Failed' state. Verify that exactly 5 child task runs are in the "
        f"'Failed' state, and that together with the Completed ones they account for "
        f"the 20 total child task runs of this flow run."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_failed_child_task_runs",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
