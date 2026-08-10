import os
import socket
import subprocess
import time

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier  # type: ignore[import-not-found]

HOST = "127.0.0.1"
API_PORT = 4200
API_URL = f"http://{HOST}:{API_PORT}/api"
BASE_URL = f"http://{HOST}:{API_PORT}"

PROJECT_DIR = "/home/user/scheduler_project"
SERVE_SCRIPT = "/home/user/scheduler_project/serve_deployment.py"
RUN_ID_PATH = "/logs/artifacts/run-id"


def _read_run_id():
    with open(RUN_ID_PATH) as f:
        return f.read().strip()


RUN_ID = _read_run_id()
FLOW_NAME = f"pulse-sync-{RUN_ID}"
DEPLOYMENT_NAME = f"tri-cadence-{RUN_ID}"


def _prefect_env():
    env = os.environ.copy()
    env["PREFECT_API_URL"] = API_URL
    return env


def _api_healthy():
    try:
        resp = requests.get(f"{API_URL}/health", timeout=5)
        return resp.status_code == 200
    except requests.RequestException:
        return False


def _get_deployment():
    """Return the deployment JSON if it exists, else None."""
    try:
        resp = requests.get(
            f"{API_URL}/deployments/name/{FLOW_NAME}/{DEPLOYMENT_NAME}", timeout=10
        )
    except requests.RequestException:
        return None
    if resp.status_code == 200:
        return resp.json()
    return None


def _count_scheduled_runs(deployment_id):
    try:
        resp = requests.post(
            f"{API_URL}/flow_runs/filter",
            json={
                "deployments": {"id": {"any_": [deployment_id]}},
                "flow_runs": {"state": {"type": {"any_": ["SCHEDULED"]}}},
                "limit": 10,
            },
            timeout=10,
        )
    except requests.RequestException:
        return 0
    if resp.status_code != 200:
        return 0
    return len(resp.json())


@pytest.fixture(scope="session")
def prefect_server():
    """Ensure a local Prefect server is reachable, starting one if necessary."""
    if _api_healthy():
        yield
        return

    proc = subprocess.Popen(
        ["prefect", "server", "start", "--host", HOST, "--port", str(API_PORT)],
        env=_prefect_env(),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    deadline = time.time() + 180
    while time.time() < deadline:
        if _api_healthy():
            break
        if proc.poll() is not None:
            out = proc.stdout.read() if proc.stdout else ""
            raise RuntimeError(f"Prefect server exited early:\n{out}")
        time.sleep(2)
    else:
        proc.terminate()
        raise RuntimeError("Prefect server did not become healthy within timeout.")

    yield

    proc.terminate()
    try:
        proc.wait(timeout=20)
    except subprocess.TimeoutExpired:
        proc.kill()


@pytest.fixture(scope="session")
def served_deployment(xprocess, prefect_server):
    """Start the deployment-serving process and wait for scheduled runs."""

    class Starter(ProcessStarter):
        name = "serve_deployment"
        args = ["python3", SERVE_SCRIPT]  # type: ignore[assignment]
        env = _prefect_env()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):  # type: ignore[override]
            return _get_deployment() is not None

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        try:
            with open(info.logpath, "r") as f:
                lines = f.readlines()
        except OSError:
            lines = []
        new_lines = lines[printed:]
        printed = len(lines)
        print(f"===== [{tag}] serve_deployment log begin =====")
        print("".join(new_lines))
        print(f"===== [{tag}] serve_deployment log end =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    # Wait until the scheduler has produced upcoming (SCHEDULED) runs.
    deployment = _get_deployment()
    assert deployment is not None, (
        f"Deployment {FLOW_NAME}/{DEPLOYMENT_NAME} was not registered on the server."
    )
    deployment_id = deployment["id"]
    deadline = time.time() + 150
    while time.time() < deadline:
        if _count_scheduled_runs(deployment_id) > 0:
            break
        time.sleep(3)

    yield deployment

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


def test_deployment_page_shows_three_active_schedules(served_deployment, browser_verifier):
    reason = (
        "A single Prefect deployment must carry three simultaneous, independently-active "
        "schedules of three different kinds (cron, interval, and rrule), all visible and "
        "inspectable on the deployment's page in the local Prefect UI."
    )
    truth = (
        f"Navigate to {BASE_URL}/deployments. Find and open the deployment named "
        f"'{DEPLOYMENT_NAME}' (it belongs to the flow '{FLOW_NAME}'). On the deployment "
        f"detail page, locate the Schedules section. Verify that it contains exactly three "
        f"schedules and that all three are active/enabled (none are paused). Verify that the "
        f"three schedules are of three different kinds: exactly one cron schedule, exactly one "
        f"interval schedule, and exactly one rrule schedule. Verify the cron schedule runs on "
        f"the cron expression '17 6 * * 1' (equivalently: 06:17 on Mondays; a humanized wording "
        f"is acceptable as long as it corresponds to this cron expression). Verify the interval "
        f"schedule runs every 900 seconds (equivalently every 15 minutes). Verify the third "
        f"schedule is an rrule (calendar recurrence) schedule that runs every 2 days at 09:30 "
        f"(corresponding to the rrule 'FREQ=DAILY;INTERVAL=2;BYHOUR=9;BYMINUTE=30;BYSECOND=0'). "
        f"The check passes only if all three schedules exist, are active, and match these cadences."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_deployment_page_shows_three_active_schedules",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_schedule_slugs_and_parameter_overrides(served_deployment, browser_verifier):
    reason = (
        "Each of the deployment's three schedules must be individually identifiable in the UI "
        "by its own unique slug and its own override of the flow's 'channel' parameter, so the "
        "three schedules are distinguishable from one another."
    )
    truth = (
        f"Navigate to {BASE_URL}/deployments and open the deployment named '{DEPLOYMENT_NAME}'. "
        f"Inspect its three schedules (open or expand each schedule's details/edit view if the "
        f"slug or parameters are not shown directly in the list). Verify that the three schedules "
        f"carry these three distinct slugs: 'weekly-cron-audit', 'interval-heartbeat', and "
        f"'rrule-biday-report'. Verify that each schedule overrides the flow parameter 'channel' "
        f"with a distinct value, and that the values map to the correct schedule types as follows: "
        f"the cron schedule (cron '17 6 * * 1', slug 'weekly-cron-audit') sets channel to "
        f"'cron-weekly'; the interval schedule (every 900 seconds, slug 'interval-heartbeat') sets "
        f"channel to 'interval-15min'; the rrule schedule (slug 'rrule-biday-report') sets channel "
        f"to 'rrule-biday'. The check passes only if all three slugs and all three distinct "
        f"'channel' override values are present and correctly paired with their schedule types."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_schedule_slugs_and_parameter_overrides",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_deployment_has_upcoming_runs(served_deployment, browser_verifier):
    reason = (
        "Because the deployment is served locally with three active schedules, the server must "
        "have generated upcoming (scheduled) flow runs for it, visible in the UI."
    )
    truth = (
        f"Navigate to {BASE_URL}/deployments and open the deployment named '{DEPLOYMENT_NAME}'. "
        f"Find the list of upcoming (scheduled) runs for this deployment (for example the "
        f"'Upcoming' runs view or the runs list filtered to scheduled runs). Verify that at least "
        f"one upcoming/scheduled flow run is present for this deployment, demonstrating that its "
        f"schedules are actively producing future runs. The check passes only if one or more "
        f"upcoming scheduled runs are shown."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_deployment_has_upcoming_runs",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
