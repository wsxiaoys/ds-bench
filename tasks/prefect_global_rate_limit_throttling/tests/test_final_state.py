# pyright: reportMissingImports=false, reportIncompatibleMethodOverride=false, reportAssignmentType=false
import os
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/prefect-throttle"
ENTRYPOINT = "throttle.py"
RUN_ID_FILE = "/logs/artifacts/run-id"

# Bind/connect over IPv4 explicitly. `localhost` can resolve to the IPv6
# loopback (::1) on some stacks, so we always use 127.0.0.1 to avoid a
# readiness check that hangs for the full timeout.
HOST = "127.0.0.1"
PORT = 4200
BASE_URL = f"http://{HOST}:{PORT}"
API_URL = f"{BASE_URL}/api"

# Fresh, dedicated Prefect data directories so run/limit state is deterministic
# and independent of whatever the executor did during task execution.
SERVER_PREFECT_HOME = "/tmp/prefect-verify-server-home"
CLIENT_PREFECT_HOME = "/tmp/prefect-verify-client-home"

# Expected configuration (from the task truth).
EXPECTED_LIMIT = 4
EXPECTED_SLOT_DECAY = "1.5"
EXPECTED_RUN_COUNT = 12


def _read_run_id():
    with open(RUN_ID_FILE) as f:
        run_id = f.read().strip()
    assert run_id, f"run-id read from {RUN_ID_FILE} is empty."
    return run_id


@pytest.fixture(scope="session")
def run_id():
    return _read_run_id()


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def prefect_server(xprocess):
    """Start a local Prefect server with a fresh data directory."""

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
        # CRITICAL: set `env` as a class attribute here, NEVER inside `popen_kwargs`.
        env = {
            **os.environ,
            "PREFECT_HOME": SERVER_PREFECT_HOME,
            "PREFECT_API_URL": API_URL,
            "PREFECT_SERVER_ANALYTICS_ENABLED": "false",
        }
        popen_kwargs = {
            "cwd": "/tmp",
            "text": True,
        }
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(f"{API_URL}/health", timeout=20)
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

    yield BASE_URL

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def run_workload(prefect_server, run_id):
    """Run the deliverable once against the running local server.

    This produces the throughput-control resource and exactly the expected
    number of completed flow runs, which the browser checks then assert on.
    """
    entrypoint_path = os.path.join(PROJECT_DIR, ENTRYPOINT)
    assert os.path.isfile(entrypoint_path), (
        f"Expected deliverable entrypoint not found at {entrypoint_path}."
    )

    env = {
        **os.environ,
        "PREFECT_HOME": CLIENT_PREFECT_HOME,
        "PREFECT_API_URL": API_URL,
    }
    result = subprocess.run(
        ["python3", ENTRYPOINT],
        cwd=PROJECT_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=300,
    )
    print("===== throttle.py STDOUT =====")
    print(result.stdout)
    print("===== throttle.py STDERR =====")
    print(result.stderr)
    assert result.returncode == 0, (
        f"Running `python3 {ENTRYPOINT}` failed with exit code "
        f"{result.returncode}. See stdout/stderr above."
    )
    return run_id


def test_rate_limit_resource_configuration(run_workload, browser_verifier):
    """The named throughput-control resource must be visible in the UI with
    its exact configured permit ceiling and per-second replenishment rate."""
    current_run_id = run_workload
    limit_name = f"partner-api-throttle-{current_run_id}"

    reason = (
        "A global concurrency limit is configured as a rate limit (it has a "
        "slot decay so held permits are released gradually over time) in order "
        "to throttle a repeated workload. Its exact configuration must be "
        "visible in the Prefect UI concurrency view."
    )
    truth = (
        f"Navigate to {BASE_URL}. Open the Concurrency section of the Prefect UI "
        f"that lists global concurrency limits (use the left navigation sidebar, "
        f"or go directly to {BASE_URL}/concurrency-limits). "
        f"Find the global concurrency limit named exactly '{limit_name}'. "
        f"Verify that this limit is listed and is shown as active/enabled. "
        f"Verify that its concurrency limit (the maximum number of permits/slots) "
        f"is displayed as {EXPECTED_LIMIT}. "
        f"Verify that its 'Slot Decay Per Second' value is displayed as "
        f"{EXPECTED_SLOT_DECAY}. "
        f"The verification passes ONLY if a limit named exactly '{limit_name}' "
        f"exists, is active, has a concurrency limit of {EXPECTED_LIMIT}, and has "
        f"a slot decay per second of {EXPECTED_SLOT_DECAY}. If any of these are "
        f"missing or different, the verification fails."
    )

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_rate_limit_resource_configuration",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_all_throttled_runs_completed(run_workload, browser_verifier):
    """Exactly the expected number of flow runs of the throttled flow must all
    have reached the Completed state, as visible in the UI flow-runs view."""
    current_run_id = run_workload
    flow_name = f"throttled-dispatch-{current_run_id}"

    reason = (
        "A repeated workload is throttled over time but every dispatched unit "
        "must still finish successfully. Each unit is a flow run of the same "
        "flow, and all of them must reach the Completed state."
    )
    truth = (
        f"Navigate to {BASE_URL}. Open the Runs (flow runs) section of the "
        f"Prefect UI (use the left navigation sidebar, or go directly to "
        f"{BASE_URL}/runs). Locate the flow runs that belong to the flow named "
        f"exactly '{flow_name}'. You may filter by the flow name, or open the "
        f"flow from the Flows page and inspect its runs. "
        f"Verify that there are exactly {EXPECTED_RUN_COUNT} flow runs for the "
        f"flow '{flow_name}', and that EVERY one of those {EXPECTED_RUN_COUNT} "
        f"runs is in the 'Completed' state. "
        f"The verification passes ONLY if exactly {EXPECTED_RUN_COUNT} runs of "
        f"'{flow_name}' exist and all {EXPECTED_RUN_COUNT} of them are Completed "
        f"(none may be Running, Pending, Scheduled, Failed, Crashed, or "
        f"Cancelled). If the count differs or any run is not Completed, the "
        f"verification fails."
    )

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_all_throttled_runs_completed",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
