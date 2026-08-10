import os
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier  # pyright: ignore[reportMissingImports]

PROJECT_DIR = "/home/user/prefect-routing"
RUN_SCRIPT = os.path.join(PROJECT_DIR, "run.sh")
HOST = "127.0.0.1"
PORT = 4200
BASE_URL = f"http://{HOST}:{PORT}"
API_URL = f"{BASE_URL}/api"
RUN_ID_FILE = "/logs/artifacts/run-id"


def _read_run_id() -> str:
    with open(RUN_ID_FILE) as f:
        run_id = f.read().strip()
    assert run_id, f"run-id in {RUN_ID_FILE} is empty."
    return run_id


@pytest.fixture(scope="session")
def run_id() -> str:
    return _read_run_id()


@pytest.fixture(scope="session")
def browser_verifier() -> PochiVerifier:
    return PochiVerifier()


@pytest.fixture(scope="session")
def prefect_server(xprocess):
    """Start a local Prefect server (UI + API) bound to the IPv4 loopback."""

    server_env = os.environ.copy()
    server_env["PREFECT_API_URL"] = API_URL
    server_env.setdefault("PREFECT_HOME", "/root/.prefect")

    class Starter(ProcessStarter):
        name = "prefect_server"
        # Bind explicitly to 127.0.0.1 so the readiness probe, the executor's
        # run.sh, and the browser verifier all reach the same address.
        args = [  # pyright: ignore[reportIncompatibleMethodOverride, reportAssignmentType]
            "prefect",
            "server",
            "start",
            "--host",
            HOST,
            "--port",
            str(PORT),
        ]
        env = server_env
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):  # pyright: ignore[reportIncompatibleMethodOverride]
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

    yield API_URL

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def built_topology(prefect_server):
    """
    Execute the executor-provided reproducible entrypoint. It must build the
    work pool + three prioritized queues, register the three routed deployments,
    submit one run of each deployment, run a local worker, and exit 0 only after
    all three runs have reached a terminal state.
    """
    assert os.path.isfile(RUN_SCRIPT), f"Expected reproducible entrypoint at {RUN_SCRIPT}."

    child_env = os.environ.copy()
    child_env["PREFECT_API_URL"] = API_URL
    child_env.setdefault("PREFECT_HOME", "/root/.prefect")

    result = subprocess.run(
        ["bash", "run.sh"],
        cwd=PROJECT_DIR,
        env=child_env,
        capture_output=True,
        text=True,
        timeout=900,
    )
    print("=============== run.sh STDOUT ===============")
    print(result.stdout)
    print("=============== run.sh STDERR ===============")
    print(result.stderr)
    assert result.returncode == 0, (
        f"run.sh exited with code {result.returncode}; it must build the topology, "
        f"run all deployments to completion, and exit 0."
    )
    return True


def test_work_pool_exists(prefect_server, built_topology, browser_verifier, run_id):
    pool = f"routing-pool-{run_id}"
    reason = (
        "The executor must create exactly one local process-type work pool that hosts "
        "the prioritized work queues, and it must be visible in the Prefect UI."
    )
    truth = (
        f"Navigate to {BASE_URL}/work-pools. Verify that a work pool named "
        f"'{pool}' is listed. Open '{pool}' and verify that its type / execution "
        f"environment is the local process worker type (shown as 'Process' or 'process')."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_work_pool_exists",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_work_queues_priorities_and_concurrency(prefect_server, built_topology, browser_verifier, run_id):
    pool = f"routing-pool-{run_id}"
    critical = f"critical-{run_id}"
    standard = f"standard-{run_id}"
    bulk = f"bulk-{run_id}"
    reason = (
        "The work pool must contain three additional prioritized work queues, each with "
        "a distinct priority and its own per-queue concurrency limit, all observable in the UI."
    )
    truth = (
        f"Navigate to {BASE_URL}/work-pools and open the work pool '{pool}'. "
        f"View its work queues. Verify that, in addition to any default queue, exactly three "
        f"queues exist with these exact priorities and concurrency limits: "
        f"the queue named '{critical}' has priority 1 and a concurrency limit of 1; "
        f"the queue named '{standard}' has priority 5 and a concurrency limit of 3; "
        f"the queue named '{bulk}' has priority 10 and a concurrency limit of 5. "
        f"Each queue's priority number and concurrency limit must match exactly."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_work_queues_priorities_and_concurrency",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_deployments_routed_to_queues(prefect_server, built_topology, browser_verifier, run_id):
    pool = f"routing-pool-{run_id}"
    reason = (
        "Each of the three deployments must be routed to one specific named work queue, "
        "and that association must be visible in the UI."
    )
    truth = (
        f"Navigate to {BASE_URL}/deployments. Verify that the following three deployments "
        f"exist and open each one to confirm its work pool and work queue association: "
        f"deployment 'critical-deploy-{run_id}' is associated with work pool '{pool}' and "
        f"work queue 'critical-{run_id}'; "
        f"deployment 'standard-deploy-{run_id}' is associated with work pool '{pool}' and "
        f"work queue 'standard-{run_id}'; "
        f"deployment 'bulk-deploy-{run_id}' is associated with work pool '{pool}' and "
        f"work queue 'bulk-{run_id}'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_deployments_routed_to_queues",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_flow_runs_completed(prefect_server, built_topology, browser_verifier, run_id):
    reason = (
        "One run of every deployment must actually be dispatched through its queue and "
        "reach the terminal Completed state, observable on the Flow Runs page."
    )
    truth = (
        f"Navigate to {BASE_URL}/runs (the Flow Runs page). For each of the deployments "
        f"'critical-deploy-{run_id}', 'standard-deploy-{run_id}', and 'bulk-deploy-{run_id}', "
        f"verify that at least one flow run exists and that its state is 'Completed'. "
        f"You may filter or search by deployment name to locate each run. All three "
        f"deployments must show a Completed flow run."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_flow_runs_completed",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
