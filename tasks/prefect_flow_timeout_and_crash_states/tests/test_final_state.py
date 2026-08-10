# pyright: reportMissingImports=false, reportIncompatibleMethodOverride=false, reportAssignmentType=false
import os
import socket
import subprocess
import time

import pytest
import requests
from pochi_verifier import PochiVerifier
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/flow_states"
HOST = "127.0.0.1"
PORT = 4200
API_URL = f"http://{HOST}:{PORT}/api"
UI_FLOW_RUNS_URL = f"http://{HOST}:{PORT}/runs/flow-runs"
RUN_ID_PATH = "/logs/artifacts/run-id"

# Terminal state name (as shown in the Prefect UI) expected for each flow.
EXPECTED = {
    "timeout": ("TimedOut", "timeout-flow"),
    "crash": ("Crashed", "crash-flow"),
    "failure": ("Failed", "failure-flow"),
}


def _read_run_id():
    with open(RUN_ID_PATH) as f:
        return f.read().strip()


def _flow_name(base):
    return f"{base}-{_read_run_id()}"


def _server_up():
    try:
        resp = requests.get(f"{API_URL}/health", timeout=5)
        return resp.status_code == 200
    except requests.RequestException:
        return False


def _query_terminal_state(flow_name):
    """Return the terminal state name for the newest matching flow run, or None."""
    body = {
        "flows": {"name": {"any_": [flow_name]}},
        "sort": "START_TIME_DESC",
        "limit": 50,
    }
    try:
        resp = requests.post(f"{API_URL}/flow_runs/filter", json=body, timeout=15)
    except requests.RequestException:
        return None
    if resp.status_code != 200:
        return None
    for run in resp.json():
        state = run.get("state") or {}
        if state.get("type") in {"COMPLETED", "FAILED", "CRASHED", "CANCELLED"}:
            return state.get("name")
    return None


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def prefect_server(xprocess):
    """Ensure a local Prefect server is reachable at 127.0.0.1:4200."""
    if _server_up():
        # A server (possibly the one the agent used) is already running; reuse it.
        yield
        return

    class Starter(ProcessStarter):
        name = "prefect_server"
        args = ["prefect", "server", "start", "--host", HOST, "--port", str(PORT)]
        env = os.environ.copy()
        env["PREFECT_API_URL"] = API_URL
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            return _server_up()

    info = xprocess.getinfo(Starter.name)
    started = False

    def capture_logs(tag):
        try:
            with open(info.logpath, "r") as f:
                content = f.read()
        except OSError:
            content = "(no log file)"
        print(f"===== [{tag}] prefect_server log begin =====")
        print(content)
        print(f"===== [{tag}] prefect_server log end   =====")

    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def generated_runs(prefect_server):
    """Run the project's entrypoint and wait until the three runs are terminal."""
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

    env = os.environ.copy()
    env["PREFECT_API_URL"] = API_URL

    entrypoint = os.path.join(PROJECT_DIR, "run_all.py")
    if os.path.isfile(entrypoint):
        try:
            proc = subprocess.run(
                ["python3", "run_all.py"],
                cwd=PROJECT_DIR,
                env=env,
                capture_output=True,
                text=True,
                timeout=300,
            )
            print("===== run_all.py stdout =====")
            print(proc.stdout)
            print("===== run_all.py stderr =====")
            print(proc.stderr)
        except subprocess.TimeoutExpired as exc:
            print(f"run_all.py timed out: {exc}")

    # Poll until each flow has at least one terminal run (or timeout).
    deadline = time.time() + 180
    names = {key: _flow_name(base) for key, (_, base) in EXPECTED.items()}
    last = {}
    while time.time() < deadline:
        last = {key: _query_terminal_state(name) for key, name in names.items()}
        if all(v is not None for v in last.values()):
            break
        time.sleep(3)
    print(f"Observed terminal states via API: {last}")
    yield names


def _verify_state(browser_verifier, flow_name, expected_state, test_case):
    reason = (
        "The local Prefect UI must show that the three flows ended in three distinct "
        "non-Completed terminal states so their failure modes can be told apart. This "
        f"check confirms the flow named '{flow_name}' produced a run in the "
        f"'{expected_state}' state."
    )
    truth = (
        f"Navigate to {UI_FLOW_RUNS_URL} (the Prefect Flow Runs page). "
        f"Locate a flow run that belongs to the flow named '{flow_name}'. You may use the "
        "page's name/flow filter or search box and scroll as needed to find it. "
        f"Verify that such a run exists and that its terminal state is '{expected_state}'. "
        f"The verification passes only if a run for flow '{flow_name}' is shown in the "
        f"'{expected_state}' state."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir=f"/logs/verifier/pochi/{test_case}",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_timeout_flow_run_is_timed_out(generated_runs, browser_verifier):
    expected_state, base = EXPECTED["timeout"]
    _verify_state(
        browser_verifier,
        _flow_name(base),
        expected_state,
        "test_timeout_flow_run_is_timed_out",
    )


def test_crash_flow_run_is_crashed(generated_runs, browser_verifier):
    expected_state, base = EXPECTED["crash"]
    _verify_state(
        browser_verifier,
        _flow_name(base),
        expected_state,
        "test_crash_flow_run_is_crashed",
    )


def test_failure_flow_run_is_failed(generated_runs, browser_verifier):
    expected_state, base = EXPECTED["failure"]
    _verify_state(
        browser_verifier,
        _flow_name(base),
        expected_state,
        "test_failure_flow_run_is_failed",
    )
