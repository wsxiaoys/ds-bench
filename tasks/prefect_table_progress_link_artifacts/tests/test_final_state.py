# pyright: reportMissingImports=false, reportIncompatibleMethodOverride=false, reportAssignmentType=false
import os
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/prefect-artifacts-project"
# Always connect over IPv4 loopback explicitly. `localhost` may resolve to the
# IPv6 loopback (::1) while the server listens on 127.0.0.1 only, causing the
# readiness check to hang for the full timeout.
HOST = "127.0.0.1"
PORT = 4200
UI_URL = f"http://{HOST}:{PORT}"
API_URL = f"http://{HOST}:{PORT}/api"
ARTIFACTS_PAGE = f"{UI_URL}/artifacts"
RUN_ID_FILE = "/logs/artifacts/run-id"


def _read_run_id():
    with open(RUN_ID_FILE) as f:
        return f.read().strip()


RUN_ID = _read_run_id()
TABLE_KEY = f"regional-sales-report-{RUN_ID}"
PROGRESS_KEY = f"ingest-progress-{RUN_ID}"
LINK_KEY = f"source-link-{RUN_ID}"


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def prefect_server(xprocess):
    """Start a local Prefect server (UI + API) on 127.0.0.1:4200."""

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
        # CRITICAL: set `env` as a class attribute, never inside popen_kwargs.
        env = {**os.environ, "PREFECT_API_URL": API_URL}
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        # First boot runs DB migrations, which can be slow.
        timeout = 300
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
        print(f"===================== [{tag}: Begin] {Starter.name} log =====================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"===================== [{tag}: End  ] {Starter.name} log =====================")

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
def pipeline_executed(prefect_server):
    """Run the agent's pipeline twice so the table report gains version history."""
    env = {**os.environ, "PREFECT_API_URL": API_URL}
    for attempt in range(2):
        result = subprocess.run(
            ["python3", "pipeline.py"],
            cwd=PROJECT_DIR,
            env=env,
            capture_output=True,
            text=True,
            timeout=300,
        )
        print(f"===== pipeline run {attempt + 1} stdout =====\n{result.stdout}")
        print(f"===== pipeline run {attempt + 1} stderr =====\n{result.stderr}")
        assert result.returncode == 0, (
            f"Running 'python3 pipeline.py' (attempt {attempt + 1}) failed with "
            f"exit code {result.returncode}. stderr: {result.stderr}"
        )
    return True


def _verify(browser_verifier, reason, truth, trajectory_name):
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir=f"/logs/verifier/pochi/{trajectory_name}",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_artifacts_page_lists_all_three(pipeline_executed, browser_verifier):
    reason = (
        "The reporting pipeline must publish three keyed artifacts that are "
        "discoverable on the Prefect Artifacts page."
    )
    truth = (
        f"Navigate to {ARTIFACTS_PAGE} in the local Prefect UI. Wait for the "
        f"Artifacts list to load. Verify that the page lists an artifact with the "
        f"key '{TABLE_KEY}', an artifact with the key '{PROGRESS_KEY}', and an "
        f"artifact with the key '{LINK_KEY}'. Use the search/filter box if needed "
        f"to locate each key. All three keys must be present."
    )
    _verify(browser_verifier, reason, truth, "test_artifacts_page_lists_all_three")


def test_table_artifact_content(pipeline_executed, browser_verifier):
    reason = (
        "The table artifact must render a regional sales report with a fixed set "
        "of columns and rows derived deterministically from the input dataset."
    )
    truth = (
        f"Navigate to {ARTIFACTS_PAGE} in the local Prefect UI. Open the artifact "
        f"whose key is '{TABLE_KEY}'. Verify the rendered table has exactly these "
        f"four column headers: 'region', 'units_sold', 'unit_price', and 'revenue'. "
        f"Verify the table contains these rows with these exact values: "
        f"region 'north' with units_sold 120, unit_price 4, revenue 480; "
        f"region 'south' with units_sold 75, unit_price 12, revenue 900; "
        f"region 'east' with units_sold 200, unit_price 3, revenue 600; "
        f"region 'west' with units_sold 50, unit_price 20, revenue 1000."
    )
    _verify(browser_verifier, reason, truth, "test_table_artifact_content")


def test_table_artifact_has_version_history(pipeline_executed, browser_verifier):
    reason = (
        "The table report uses a stable key, so running the pipeline more than "
        "once must accumulate multiple versions under that key."
    )
    truth = (
        f"Navigate to {ARTIFACTS_PAGE} in the local Prefect UI. Open the artifact "
        f"whose key is '{TABLE_KEY}'. Verify the artifact shows version history "
        f"with more than one version (at least two versions of this same keyed "
        f"artifact exist, for example a version selector/dropdown or a list "
        f"showing two or more versions)."
    )
    _verify(browser_verifier, reason, truth, "test_table_artifact_has_version_history")


def test_progress_artifact_complete(pipeline_executed, browser_verifier):
    reason = (
        "The progress artifact must indicate that ingestion has fully completed "
        "once the run finishes."
    )
    truth = (
        f"Navigate to {ARTIFACTS_PAGE} in the local Prefect UI. Open the artifact "
        f"whose key is '{PROGRESS_KEY}'. Verify it renders as a progress indicator "
        f"showing 100% (fully complete)."
    )
    _verify(browser_verifier, reason, truth, "test_progress_artifact_complete")


def test_link_artifact_label(pipeline_executed, browser_verifier):
    reason = (
        "The link artifact must display a specific human-readable label for its "
        "target."
    )
    truth = (
        f"Navigate to {ARTIFACTS_PAGE} in the local Prefect UI. Open the artifact "
        f"whose key is '{LINK_KEY}'. Verify it renders a hyperlink whose visible "
        f"display text is exactly 'Regional Sales Source'."
    )
    _verify(browser_verifier, reason, truth, "test_link_artifact_label")


def test_run_detail_shows_artifact_bundle(pipeline_executed, browser_verifier):
    reason = (
        "Every artifact must also be attached to its pipeline run and visible on "
        "that run's detail page."
    )
    truth = (
        f"Navigate to {UI_URL}/runs in the local Prefect UI and open the most "
        f"recent successful flow run of the reporting pipeline. On that run's "
        f"detail page, open its Artifacts section and verify it shows the run's "
        f"table report, progress, and link artifacts (the artifacts with keys "
        f"'{TABLE_KEY}', '{PROGRESS_KEY}', and '{LINK_KEY}')."
    )
    _verify(browser_verifier, reason, truth, "test_run_detail_shows_artifact_bundle")
