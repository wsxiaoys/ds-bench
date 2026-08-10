import os
import socket
import subprocess
import time

import pytest
import requests
from pochi_verifier import PochiVerifier  # type: ignore

PROJECT_DIR = "/home/user/reactive_pipeline"
# Always use the IPv4 loopback explicitly. `localhost` can resolve to the IPv6
# loopback (::1), while the Prefect server binds 127.0.0.1 only, which would make
# readiness checks hang for the full timeout.
HOST = "127.0.0.1"
API_PORT = 4200
API_URL = f"http://{HOST}:{API_PORT}/api"
UI_URL = f"http://{HOST}:{API_PORT}"

RUN_ID_FILE = "/logs/artifacts/run-id"


def _read_run_id():
    with open(RUN_ID_FILE) as f:
        return f.read().strip()


def _port_open(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex((host, port)) == 0


def _api_healthy():
    try:
        r = requests.get(f"{API_URL}/health", timeout=5)
        return r.status_code == 200
    except requests.RequestException:
        return False


def _deployment_names():
    r = requests.post(f"{API_URL}/deployments/filter", json={}, timeout=20)
    r.raise_for_status()
    return [d.get("name") for d in r.json()]


def _flow_runs_for_flow(flow_name):
    body = {"flows": {"name": {"any_": [flow_name]}}, "limit": 50}
    r = requests.post(f"{API_URL}/flow_runs/filter", json=body, timeout=20)
    r.raise_for_status()
    return r.json()


def _completed_flow_runs(flow_name):
    runs = _flow_runs_for_flow(flow_name)
    return [fr for fr in runs if (fr.get("state") or {}).get("type") == "COMPLETED"]


def _print_log(path, tag):
    if os.path.isfile(path):
        with open(path) as f:
            content = f.read()
        print(f"===== [{tag}] {path} (begin) =====")
        print(content)
        print(f"===== [{tag}] {path} (end) =====")


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def pipeline():
    """Bring up the server (if needed), serve both deployments, run the upstream
    deployment once, and wait until the reactive trigger has produced a completed
    downstream run. Every real assertion is performed by the browser tests below.
    """
    run_id = _read_run_id()
    up_flow = f"upstream-flow-{run_id}"
    up_deploy = f"upstream-deploy-{run_id}"
    down_flow = f"downstream-flow-{run_id}"
    down_deploy = f"downstream-deploy-{run_id}"

    env = os.environ.copy()
    env["PREFECT_API_URL"] = API_URL

    server_proc = None
    server_log_path = "/tmp/prefect_server.log"
    serve_log_path = "/tmp/serve_main.log"

    # 1. Ensure the local Prefect server is up and healthy.
    if not _api_healthy():
        server_log = open(server_log_path, "w")
        server_proc = subprocess.Popen(
            ["prefect", "server", "start", "--host", HOST, "--port", str(API_PORT)],
            cwd=PROJECT_DIR,
            stdout=server_log,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
        )
        deadline = time.time() + 150
        while time.time() < deadline and not _api_healthy():
            time.sleep(2)

    assert _api_healthy(), (
        f"Local Prefect server did not become healthy at {API_URL}."
    )

    # 2. Start the agent's entrypoint that registers and serves both deployments.
    serve_log = open(serve_log_path, "w")
    serve_proc = subprocess.Popen(
        ["python3", "main.py"],
        cwd=PROJECT_DIR,
        stdout=serve_log,
        stderr=subprocess.STDOUT,
        text=True,
        env=env,
    )

    try:
        # 3. Wait for both deployments to be registered on the server.
        deadline = time.time() + 150
        names = []
        while time.time() < deadline:
            try:
                names = _deployment_names()
            except requests.RequestException:
                names = []
            if up_deploy in names and down_deploy in names:
                break
            if serve_proc.poll() is not None:
                break
            time.sleep(3)

        # 4. Trigger the upstream deployment exactly once.
        subprocess.run(
            ["prefect", "deployment", "run", f"{up_flow}/{up_deploy}"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            env=env,
        )

        # 5. Wait for the upstream run to complete and the reactive trigger to
        #    produce a completed downstream run.
        deadline = time.time() + 300
        while time.time() < deadline:
            up_done = len(_completed_flow_runs(up_flow)) > 0
            down_done = len(_completed_flow_runs(down_flow)) > 0
            if up_done and down_done:
                break
            time.sleep(5)

        _print_log(server_log_path, "prefect-server")
        _print_log(serve_log_path, "serve-main")

        yield {
            "run_id": run_id,
            "up_flow": up_flow,
            "up_deploy": up_deploy,
            "down_flow": down_flow,
            "down_deploy": down_deploy,
        }
    finally:
        serve_proc.terminate()
        try:
            serve_proc.wait(timeout=30)
        except subprocess.TimeoutExpired:
            serve_proc.kill()
        if server_proc is not None:
            server_proc.terminate()
            try:
                server_proc.wait(timeout=30)
            except subprocess.TimeoutExpired:
                server_proc.kill()


def test_both_deployments_visible(pipeline, browser_verifier):
    up_deploy = pipeline["up_deploy"]
    down_deploy = pipeline["down_deploy"]
    reason = (
        "Two local Prefect deployments must exist: an upstream (producer) "
        "deployment and a downstream (consumer) deployment."
    )
    truth = (
        f"Navigate to the Prefect Deployments page at {UI_URL}/deployments. "
        f"Verify that a deployment named '{up_deploy}' is listed AND a deployment "
        f"named '{down_deploy}' is listed. Both must be present."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_both_deployments_visible",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_downstream_reactive_trigger_configured(pipeline, browser_verifier):
    down_deploy = pipeline["down_deploy"]
    up_deploy = pipeline["up_deploy"]
    reason = (
        "The downstream deployment must carry a reactive event trigger that runs "
        "it automatically when the upstream deployment's flow run reaches the "
        "Completed state (not a schedule)."
    )
    truth = (
        f"Navigate to the Prefect UI at {UI_URL}. Open the downstream deployment "
        f"'{down_deploy}' (check its details/Triggers section) and/or the Automations "
        f"page at {UI_URL}/automations. Verify that there is an event-based (reactive) "
        f"trigger/automation configured whose action runs the downstream deployment "
        f"'{down_deploy}' and which reacts to a flow run of the upstream deployment "
        f"'{up_deploy}' reaching the Completed state. Confirm it is an event-reactive "
        f"trigger and NOT a time-based schedule."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_downstream_reactive_trigger_configured",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_upstream_run_completed(pipeline, browser_verifier):
    up_flow = pipeline["up_flow"]
    up_deploy = pipeline["up_deploy"]
    reason = (
        "The upstream deployment was run once and its flow run must have finished "
        "successfully in the Completed state."
    )
    truth = (
        f"Navigate to the Prefect Flow Runs page at {UI_URL}/runs. Verify that there "
        f"is a flow run of the flow '{up_flow}' (from deployment '{up_deploy}') whose "
        f"state is Completed."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_upstream_run_completed",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_downstream_run_auto_created_and_completed(pipeline, browser_verifier):
    down_flow = pipeline["down_flow"]
    down_deploy = pipeline["down_deploy"]
    up_flow = pipeline["up_flow"]
    reason = (
        "The reactive trigger must have automatically launched the downstream "
        "deployment after the upstream run completed. The downstream deployment was "
        "never started manually or on a schedule, so a Completed downstream flow run "
        "proves the trigger fired."
    )
    truth = (
        f"Navigate to the Prefect Flow Runs page at {UI_URL}/runs. Verify that there "
        f"is at least one flow run of the flow '{down_flow}' (from deployment "
        f"'{down_deploy}') whose state is Completed. This downstream run was created "
        f"automatically by the reactive trigger, not manually. Also confirm that the "
        f"downstream run started after the upstream flow '{up_flow}' reached Completed "
        f"(the downstream run's start/creation time is later than the upstream run's "
        f"completion)."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_downstream_run_auto_created_and_completed",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
