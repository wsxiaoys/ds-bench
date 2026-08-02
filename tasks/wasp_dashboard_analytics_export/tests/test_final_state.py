import pytest
import subprocess
import os
import socket
import requests
import shutil
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

def test_prisma_raw_query_usage():
    """Verify that the implementation uses Prisma raw queries for data aggregation."""
    src_dir = os.path.join(PROJECT_DIR, "src")
    found_raw_query = False
    assert os.path.isdir(src_dir), "src directory does not exist."
    for root, _, files in os.walk(src_dir):
        for file in files:
            if file.endswith((".ts", ".tsx", ".js", ".jsx")):
                with open(os.path.join(root, file), "r", errors="ignore") as f:
                    content = f.read()
                    if "$queryRaw" in content or "$queryRawUnsafe" in content:
                        found_raw_query = True
                        break
        if found_raw_query:
            break
    assert found_raw_query, "The backend query must use Prisma raw queries ($queryRaw or $queryRawUnsafe) for time-series aggregation."

def test_task_verification(start_app, browser_verifier):
    """Run browser-based verification using PochiVerifier."""
    reason = "Financial analytics dashboard must correctly aggregate data, secure routes with auth, and export to CSV."
    truth = (
        "1. Navigate to http://127.0.0.1:3000/login.\n"
        "2. Log in using username 'testuser' and password 'password123'.\n"
        "3. Verify that you are redirected to the main dashboard page.\n"
        "4. Verify that the default date range is '2026-07-01' to '2026-07-31' and resolution is 'day'.\n"
        "5. Verify that the summary cards show:\n"
        "   - Total Income: 7500 or 7,500.00\n"
        "   - Total Expense: 2000 or 2,000.00\n"
        "   - Net Savings: 5500 or 5,500.00\n"
        "   - Savings Rate: 73.33%\n"
        "6. Click the 'Export CSV' button, wait for the download of 'analytics_export.csv' to complete, and verify its contents match exactly:\n"
        "   Date,Income,Expense,Net\n"
        "   2026-07-01,5000,0,5000\n"
        "   2026-07-15,0,1200,-1200\n"
        "   2026-07-20,0,800,-800\n"
        "   2026-07-25,2500,0,2500\n"
        "7. Change the Start Date input to '2026-07-10'.\n"
        "8. Verify that the summary updates to:\n"
        "   - Total Income: 2500 or 2,500.00\n"
        "   - Total Expense: 2000 or 2,000.00\n"
        "   - Net Savings: 500 or 500.00\n"
        "   - Savings Rate: 20.00% or 20%\n"
        "9. Verify that the table updates to display exactly 3 rows (representing the dates 2026-07-15, 2026-07-20, 2026-07-25)."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_task_verification"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
