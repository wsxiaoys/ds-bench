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

def test_prisma_transaction_usage():
    """Verify that the implementation uses Prisma interactive transactions ($transaction) for fulfilling orders."""
    src_dir = os.path.join(PROJECT_DIR, "src")
    found_transaction = False
    assert os.path.isdir(src_dir), "src directory does not exist."
    for root, _, files in os.walk(src_dir):
        for file in files:
            if file.endswith((".ts", ".tsx", ".js", ".jsx")):
                with open(os.path.join(root, file), "r", errors="ignore") as f:
                    content = f.read()
                    if "$transaction" in content:
                        found_transaction = True
                        break
        if found_transaction:
            break
    assert found_transaction, "The backend action must use Prisma interactive transactions ($transaction) for order fulfillment."

def test_task_verification(start_app, browser_verifier):
    """Run browser-based verification using PochiVerifier."""
    reason = "Inventory platform must track stock levels, fulfill orders safely, and automatically trigger reorder alerts and supplier purchase orders."
    truth = (
        "1. Navigate to http://127.0.0.1:3000/login.\n"
        "2. Log in using username 'warehouse_manager' and password 'password123'.\n"
        "3. Verify that you are redirected to the main dashboard page at http://127.0.0.1:3000/.\n"
        "4. Verify that Product 'PROD-001' has stock level 15 (element with data-testid=\"product-stock-PROD-001\").\n"
        "5. Verify that Product 'PROD-002' has stock level 8 (element with data-testid=\"product-stock-PROD-002\").\n"
        "6. Click the 'Fulfill Order' button for Order 1 (element with data-testid=\"fulfill-btn-1\").\n"
        "7. Verify that Order 1 status updates to 'FULFILLED' (element with data-testid=\"order-status-1\").\n"
        "8. Verify that Product 'PROD-001' stock level updates to 7 (element with data-testid=\"product-stock-PROD-001\").\n"
        "9. Verify that Product 'PROD-002' stock level updates to 6 (element with data-testid=\"product-stock-PROD-002\").\n"
        "10. Verify that a low-stock alert is generated for 'PROD-001' (inside data-testid=\"alerts-list\", in an element with data-testid=\"alert-item\" containing 'PROD-001' or 'Wireless Mouse' and 'low stock').\n"
        "11. Verify that a Supplier Purchase Order is created for 'PROD-001' (inside data-testid=\"purchase-orders-list\", in an element with data-testid=\"purchase-order-item\" containing 'Global Tech Distributors', 'PROD-001', and quantity '50').\n"
        "12. Click the 'Fulfill Order' button for Order 2 (element with data-testid=\"fulfill-btn-2\").\n"
        "13. Verify that the operation fails and displays an error message containing 'Insufficient stock' or 'Out of stock' inside an element with data-testid=\"fulfillment-error\".\n"
        "14. Verify that Order 2 status remains 'PENDING' (element with data-testid=\"order-status-2\").\n"
        "15. Verify that Product stock levels remain unchanged (PROD-001 is still 7, PROD-002 is still 6)."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_task_verification"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
