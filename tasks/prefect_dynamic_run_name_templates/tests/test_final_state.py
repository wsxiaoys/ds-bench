# pyright: reportMissingImports=false, reportIncompatibleMethodOverride=false, reportAssignmentType=false
import os
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/pipeline"
RUN_ID_FILE = "/logs/artifacts/run-id"
HOST = "127.0.0.1"
PORT = 4200
BASE_URL = f"http://{HOST}:{PORT}"
API_URL = f"http://{HOST}:{PORT}/api"

# The exact input sets the flow must be run with, and the deterministic
# dynamic names each set must produce (before appending the run-id suffix).
PARAM_SETS = [
    {"region": "emea", "batch": 10},
    {"region": "apac", "batch": 25},
    {"region": "amer", "batch": 50},
]


@pytest.fixture(scope="session")
def run_id():
    assert os.path.isfile(RUN_ID_FILE), f"run-id file {RUN_ID_FILE} does not exist."
    with open(RUN_ID_FILE) as f:
        value = f.read().strip()
    assert value, f"run-id file {RUN_ID_FILE} is empty."
    return value


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def prefect_server(xprocess):
    """Start the local Prefect server (UI + API) on 127.0.0.1:4200."""

    class Starter(ProcessStarter):
        name = "prefect_server"
        args = [
            "prefect",
            "server",
            "start",
            "--host",
            HOST,
            "--port",
            str(PORT),
        ]
        env = os.environ.copy()
        env["PREFECT_API_URL"] = API_URL
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 300
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(f"{API_URL}/health", timeout=20)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        with open(info.logpath, "r") as f:
            all_lines = f.readlines()
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"============ [{tag}: Begin] {Starter.name} logfile ============")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"============ [{tag}: End  ] {Starter.name} logfile ============")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield BASE_URL

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def run_flows(prefect_server, run_id):
    """Execute the flow across every required parameter set so the runs exist."""
    runner = os.path.join(PROJECT_DIR, "run_pipeline.py")
    assert os.path.isfile(runner), (
        f"Expected runner script at {runner}; it was not found."
    )

    env = os.environ.copy()
    env["PREFECT_API_URL"] = API_URL

    result = subprocess.run(
        ["python3", "run_pipeline.py"],
        cwd=PROJECT_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=600,
    )
    print("=== run_pipeline.py stdout ===")
    print(result.stdout)
    print("=== run_pipeline.py stderr ===")
    print(result.stderr)
    assert result.returncode == 0, (
        f"run_pipeline.py failed with exit code {result.returncode}."
    )
    return run_id


def test_flow_run_names_present(run_flows, prefect_server, browser_verifier):
    rid = run_flows
    expected = [
        f"ingest-{p['region']}-b{p['batch']}-{rid}" for p in PARAM_SETS
    ]
    names = ", ".join(f"'{n}'" for n in expected)
    reason = (
        "Flow runs must be recorded under human-readable, parameter-derived "
        "names instead of Prefect's random default names."
    )
    truth = (
        f"Navigate to {BASE_URL} and open the flow runs list (the 'Runs' page; "
        f"the URL {BASE_URL}/runs shows it). If a search or filter box is "
        "available, use it to search for each name. Verify that ALL of the "
        f"following flow-run names appear exactly as written: {names}. "
        "Each name must be shown verbatim (matching the region, the letter 'b' "
        "followed by the batch number, and the trailing id). Also confirm the "
        "runs are NOT shown under random two-word default names such as "
        "'vivid-lemur'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_flow_run_names_present",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


@pytest.mark.parametrize("param", PARAM_SETS)
def test_task_run_name_present(param, run_flows, prefect_server, browser_verifier):
    rid = run_flows
    region = param["region"]
    batch = param["batch"]
    flow_run_name = f"ingest-{region}-b{batch}-{rid}"
    task_run_name = f"transform-{region}-b{batch}-{rid}"
    reason = (
        "Each flow run's task must also be recorded under a dynamic, "
        "parameter-derived name rather than a random default name."
    )
    truth = (
        f"Navigate to {BASE_URL} and open the flow run named exactly "
        f"'{flow_run_name}' (you can find it from the 'Runs' page at "
        f"{BASE_URL}/runs, using the search box if needed, then click it). "
        "On that flow run's detail page, inspect its task runs and verify that "
        f"a task run named exactly '{task_run_name}' is present. The task-run "
        "name must be shown verbatim."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir=f"/logs/verifier/pochi/test_task_run_name_{region}_b{batch}",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_flow_name_present(run_flows, prefect_server, browser_verifier):
    rid = run_flows
    flow_name = f"orders-etl-{rid}"
    reason = (
        "The flow itself must be registered under the required run-id-scoped "
        "flow name."
    )
    truth = (
        f"Navigate to {BASE_URL} and open the 'Flows' page (the URL "
        f"{BASE_URL}/flows shows it). Verify that a flow named exactly "
        f"'{flow_name}' is present. Alternatively, open any of the recorded "
        "flow runs and confirm its parent flow is named "
        f"'{flow_name}'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_flow_name_present",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
