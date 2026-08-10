import pytest
import subprocess
import os
import socket
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/app"
PORT = 3000
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()

@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "start_app"
        args = ["wasp", "start"]
        env = os.environ.copy()
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
            try:
                resp = requests.get(BASE_URL, timeout=20)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        if os.path.exists(info.logpath):
            with open(info.logpath, "r", errors="ignore") as f:
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
        # Run db migration and seed before starting the app
        print("Running database migrations...")
        subprocess.run(["wasp", "db", "migrate-dev", "--name", "init"], cwd=PROJECT_DIR, check=True)
        print("Seeding database...")
        subprocess.run(["wasp", "db", "seed", "seedData"], cwd=PROJECT_DIR, check=True)

        print("Starting Wasp application...")
        xprocess.ensure(Starter.name, Starter)
        started = True
    except Exception as e:
        print(f"Startup failed: {e}")
        capture_logs("FAILED")
        raise e
    finally:
        if started:
            capture_logs("STARTED")

    yield
    capture_logs("TEARDOWN")
    info.terminate()

def test_files_exist():
    """Verify that required project files exist."""
    required_files = [
        "main.wasp.ts",
        "schema.prisma",
    ]
    for f in required_files:
        path = os.path.join(PROJECT_DIR, f)
        assert os.path.isfile(path), f"Required file {path} is missing."

def test_task_verification(start_app, browser_verifier):
    """Run browser-based verification using PochiVerifier."""
    reason = "Customer support ticketing system must handle automatic workload-based assignments, SLA countdowns, and escalations."
    truth = (
        "1. Navigate to http://127.0.0.1:3000/login.\n"
        "2. Log in using username 'customer1' and password 'password123'.\n"
        "3. Verify that you are redirected to the main dashboard page.\n"
        "4. Verify that two agents are listed with workload 0:\n"
        "   - 'agent1' workload (element with data-testid=\"agent-workload-agent1\") displays '0'.\n"
        "   - 'agent2' workload (element with data-testid=\"agent-workload-agent2\") displays '0'.\n"
        "5. Create a new support ticket:\n"
        "   - Set Title (data-testid=\"ticket-title\") to 'Database Connection Timeout'.\n"
        "   - Set Description (data-testid=\"ticket-desc\") to 'The production database is unresponsive.'.\n"
        "   - Set Priority (data-testid=\"ticket-priority\") to 'HIGH'.\n"
        "   - Click 'Submit Ticket' (data-testid=\"submit-ticket\").\n"
        "6. Verify that the ticket is created and automatically assigned to 'agent1':\n"
        "   - Find the ticket item.\n"
        "   - Verify that the assignee element (data-testid=\"ticket-assignee-1\") displays 'agent1'.\n"
        "   - Verify that 'agent1' workload (data-testid=\"agent-workload-agent1\") now displays '1'.\n"
        "7. Create a second support ticket:\n"
        "   - Set Title (data-testid=\"ticket-title\") to 'API Latency Spike'.\n"
        "   - Set Description (data-testid=\"ticket-desc\") to 'API requests are taking more than 5 seconds.'.\n"
        "   - Set Priority (data-testid=\"ticket-priority\") to 'HIGH'.\n"
        "   - Click 'Submit Ticket' (data-testid=\"submit-ticket\").\n"
        "8. Verify that the second ticket is created and automatically assigned to 'agent2':\n"
        "   - Verify that the assignee element (data-testid=\"ticket-assignee-2\") displays 'agent2'.\n"
        "   - Verify that 'agent2' workload (data-testid=\"agent-workload-agent2\") now displays '1'.\n"
        "9. Click the 'Simulate SLA Breach' button (data-testid=\"simulate-breach-1\") on the first ticket ('Database Connection Timeout').\n"
        "10. Verify that the first ticket is escalated:\n"
        "    - Verify that the escalation status (data-testid=\"ticket-escalated-1\") displays 'Yes' or 'Escalated'.\n"
        "    - Verify that the status badge (data-testid=\"ticket-status-badge-1\") displays 'ESCALATED'.\n"
        "    - Verify that the assignee (data-testid=\"ticket-assignee-1\") is now 'manager'.\n"
        "    - Verify that 'agent1' workload (data-testid=\"agent-workload-agent1\") goes back to '0'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_task_verification"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
