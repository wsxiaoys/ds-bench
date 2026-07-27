import glob
import os
import socket
import subprocess

import pytest
import requests
from pochi_verifier import PochiVerifier  # type: ignore
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/gcl_pipeline"
MAIN_SCRIPT = os.path.join(PROJECT_DIR, "main.py")

# Bind/connect over IPv4 explicitly. `localhost` can resolve to the IPv6 loopback
# (::1) while the server listens on 127.0.0.1 only, which would make readiness
# checks hang for the full timeout. Always use 127.0.0.1.
HOST = "127.0.0.1"
PORT = 4200
UI_URL = f"http://{HOST}:{PORT}"
API_URL = f"http://{HOST}:{PORT}/api"

# Isolate server state so flow-run counts are exact and reproducible.
PREFECT_HOME = "/home/user/.prefect"

# Expected hard requirements (from task_description / truth).
LIMIT_BASENAME = "throughput-guard"
UNIT_FLOW_BASENAME = "payload-unit"
EXPECTED_SLOTS = 2
EXPECTED_UNITS = 8

RUN_ID_FILE = "/logs/artifacts/run-id"


def _read_run_id():
    with open(RUN_ID_FILE) as f:
        return f.read().strip()


RUN_ID = _read_run_id()
LIMIT_NAME = f"{LIMIT_BASENAME}-{RUN_ID}"
UNIT_FLOW_NAME = f"{UNIT_FLOW_BASENAME}-{RUN_ID}"


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def prefect_server(xprocess):
    """Start a fresh local Prefect server on 127.0.0.1:4200.

    The server database is wiped beforehand so that only the runs produced by the
    task's own pipeline are counted during verification.
    """
    os.makedirs(PREFECT_HOME, exist_ok=True)
    for db_file in glob.glob(os.path.join(PREFECT_HOME, "prefect.db*")):
        try:
            os.remove(db_file)
        except OSError:
            pass

    server_env = os.environ.copy()
    server_env["PREFECT_HOME"] = PREFECT_HOME
    server_env["PREFECT_API_URL"] = API_URL

    class Starter(ProcessStarter):
        name = "prefect_server"
        args = ["prefect", "server", "start", "--host", HOST, "--port", str(PORT)]  # type: ignore
        env = server_env
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):  # type: ignore
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
        try:
            with open(info.logpath, "r") as f:
                all_lines = f.readlines()
        except OSError:
            all_lines = []
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"============================== [{tag}: Begin] prefect_server log ==============================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"============================== [{tag}: End  ] prefect_server log ==============================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield UI_URL

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def run_pipeline(prefect_server):
    """Execute the task's pipeline once against the running local server.

    Running the start command must both ensure the global concurrency limit
    exists and drive all units of work to completion. Its success is asserted
    exclusively through the browser verifications below.
    """
    run_env = os.environ.copy()
    run_env["PREFECT_HOME"] = PREFECT_HOME
    run_env["PREFECT_API_URL"] = API_URL

    print("============================== [PIPELINE: Begin] python3 main.py ==============================")
    try:
        result = subprocess.run(
            ["python3", "main.py"],
            cwd=PROJECT_DIR,
            env=run_env,
            capture_output=True,
            text=True,
            timeout=600,
        )
        print(f"return code: {result.returncode}")
        print("---- stdout ----")
        print(result.stdout)
        print("---- stderr ----")
        print(result.stderr)
    except subprocess.TimeoutExpired as exc:
        print("Pipeline execution timed out.")
        print(exc.stdout or "")
        print(exc.stderr or "")
    except Exception as exc:  # noqa: BLE001
        print(f"Pipeline execution raised: {exc}")
    print("============================== [PIPELINE: End  ] python3 main.py ==============================")

    yield


def test_concurrency_limit_configured(run_pipeline, browser_verifier):
    reason = (
        "The pipeline must register a single named global concurrency limit that "
        "bounds parallelism. This limit must be visible and correctly configured "
        "in the local Prefect UI."
    )
    truth = (
        f"Open {UI_URL} and navigate to the Concurrency page that lists global "
        f"concurrency limits (the section for global/active concurrency limits, not "
        f"tag-based task run limits). Verify that a global concurrency limit named "
        f"exactly '{LIMIT_NAME}' is present, is active/enabled, and shows a total "
        f"slot limit of exactly {EXPECTED_SLOTS}. Report pass ONLY if such a limit "
        f"named '{LIMIT_NAME}' exists with a limit value of {EXPECTED_SLOTS}; "
        f"otherwise report fail."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_concurrency_limit_configured",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_all_units_completed(run_pipeline, browser_verifier):
    reason = (
        "Every unit of work launched by the pipeline must eventually finish "
        "successfully under the concurrency limit; none may fail or remain stuck."
    )
    truth = (
        f"Open {UI_URL} and navigate to the Runs page that lists flow runs (Flow "
        f"Runs). Locate the flow runs whose flow is named exactly '{UNIT_FLOW_NAME}'. "
        f"Verify that there are exactly {EXPECTED_UNITS} such flow runs and that every "
        f"one of them is in the Completed state. Report fail if there are fewer or "
        f"more than {EXPECTED_UNITS} such runs, or if any of them is not Completed "
        f"(for example Failed, Crashed, Pending, Running, or Cancelled)."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_all_units_completed",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
