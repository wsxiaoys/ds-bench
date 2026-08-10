# pyright: reportMissingImports=false, reportMissingModuleSource=false, reportIncompatibleMethodOverride=false, reportAssignmentType=false
import os
import socket

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

# The Prefect server and UI are served locally on the IPv4 loopback only.
# Always use 127.0.0.1 explicitly (never `localhost`) to avoid IPv6 loopback
# resolution issues that can cause the readiness check to hang.
HOST = "127.0.0.1"
PORT = 4200
BASE_URL = f"http://{HOST}:{PORT}"
API_HEALTH_URL = f"{BASE_URL}/api/health"
RUNS_URL = f"{BASE_URL}/runs"

RUN_ID_PATH = "/logs/artifacts/run-id"


def _read_run_id():
    with open(RUN_ID_PATH) as f:
        return f.read().strip()


RUN_ID = _read_run_id()

FLOW_NAME = f"state-forcing-flow-{RUN_ID}"

# Each named flow run and the exact final state it must have been forced into.
EXPECTED_RUN_STATES = {
    f"ingest-{RUN_ID}": "Completed",
    f"transform-{RUN_ID}": "Failed",
    f"validate-{RUN_ID}": "Cancelled",
    f"publish-{RUN_ID}": "Crashed",
}


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def start_server(xprocess):
    """Start the local Prefect server so its UI/API are reachable for browser
    verification. The flow runs were created and finalized during the task and
    are persisted in the default Prefect database, so starting the server here
    only exposes that already-persisted state (it does not recreate it)."""

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
        # CRITICAL: set `env` as a class attribute here, NEVER inside
        # `popen_kwargs`, otherwise Popen raises a duplicate-keyword TypeError.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": "/home/user",
            "text": True,
        }
        timeout = 300
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(API_HEALTH_URL, timeout=20)
                return resp.status_code == 200
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
        print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"============================== [{tag}: End  ] Captured {Starter.name} logfile ==============================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def _run_browser_check(browser_verifier, reason, truth, trajectory_name):
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir=f"/logs/verifier/pochi/{trajectory_name}",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_flow_runs_page_lists_flow(start_server, browser_verifier):
    reason = (
        "The task requires four runs of a single flow to be created and finalized on the "
        "local Prefect server. Those runs must be visible in the Prefect UI."
    )
    truth = (
        f"Navigate to {RUNS_URL} which is the Flow Runs page of the locally hosted Prefect UI. "
        f"Wait for the page to finish loading. Verify that flow runs belonging to a flow named "
        f"'{FLOW_NAME}' are present in the list. You may use the search or filter box on the page "
        f"to search for '{FLOW_NAME}' or for the run names 'ingest-{RUN_ID}', 'transform-{RUN_ID}', "
        f"'validate-{RUN_ID}', and 'publish-{RUN_ID}' to confirm the runs exist."
    )
    _run_browser_check(
        browser_verifier,
        reason,
        truth,
        "test_flow_runs_page_lists_flow",
    )


def test_ingest_run_is_completed(start_server, browser_verifier):
    run_name = f"ingest-{RUN_ID}"
    reason = "The run 'ingest' must have been forced into the Completed final state."
    truth = (
        f"Navigate to {RUNS_URL} which is the Flow Runs page of the locally hosted Prefect UI. "
        f"Wait for the page to finish loading, and use the search or filter box to find the flow run "
        f"named '{run_name}'. Verify that this flow run's displayed state is 'Completed'."
    )
    _run_browser_check(
        browser_verifier,
        reason,
        truth,
        "test_ingest_run_is_completed",
    )


def test_transform_run_is_failed(start_server, browser_verifier):
    run_name = f"transform-{RUN_ID}"
    reason = "The run 'transform' must have been forced into the Failed final state."
    truth = (
        f"Navigate to {RUNS_URL} which is the Flow Runs page of the locally hosted Prefect UI. "
        f"Wait for the page to finish loading, and use the search or filter box to find the flow run "
        f"named '{run_name}'. Verify that this flow run's displayed state is 'Failed'."
    )
    _run_browser_check(
        browser_verifier,
        reason,
        truth,
        "test_transform_run_is_failed",
    )


def test_validate_run_is_cancelled(start_server, browser_verifier):
    run_name = f"validate-{RUN_ID}"
    reason = "The run 'validate' must have been forced into the Cancelled final state."
    truth = (
        f"Navigate to {RUNS_URL} which is the Flow Runs page of the locally hosted Prefect UI. "
        f"Wait for the page to finish loading, and use the search or filter box to find the flow run "
        f"named '{run_name}'. Verify that this flow run's displayed state is 'Cancelled'."
    )
    _run_browser_check(
        browser_verifier,
        reason,
        truth,
        "test_validate_run_is_cancelled",
    )


def test_publish_run_is_crashed(start_server, browser_verifier):
    run_name = f"publish-{RUN_ID}"
    reason = "The run 'publish' must have been forced into the Crashed final state."
    truth = (
        f"Navigate to {RUNS_URL} which is the Flow Runs page of the locally hosted Prefect UI. "
        f"Wait for the page to finish loading, and use the search or filter box to find the flow run "
        f"named '{run_name}'. Verify that this flow run's displayed state is 'Crashed'."
    )
    _run_browser_check(
        browser_verifier,
        reason,
        truth,
        "test_publish_run_is_crashed",
    )


def test_four_runs_show_four_distinct_states(start_server, browser_verifier):
    reason = (
        "All four runs belong to a single flow yet must display four different final states, "
        "which is only possible if their states were set directly through the Prefect server-side "
        "interface rather than produced by natural execution."
    )
    truth = (
        f"Navigate to {RUNS_URL} which is the Flow Runs page of the locally hosted Prefect UI. "
        f"Wait for the page to finish loading. All four of the following flow runs belong to the "
        f"single flow named '{FLOW_NAME}'. Confirm each run exists and shows exactly the state given: "
        f"the run 'ingest-{RUN_ID}' shows 'Completed'; the run 'transform-{RUN_ID}' shows 'Failed'; "
        f"the run 'validate-{RUN_ID}' shows 'Cancelled'; the run 'publish-{RUN_ID}' shows 'Crashed'. "
        f"Verify that these four states are all different from one another."
    )
    _run_browser_check(
        browser_verifier,
        reason,
        truth,
        "test_four_runs_show_four_distinct_states",
    )
