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
    # Ensure PostgreSQL service is started before running migrations and starting Wasp
    try:
        # Start PostgreSQL if it's not running
        subprocess.run(["service", "postgresql", "start"], check=False)
    except Exception as e:
        print(f"Could not start PostgreSQL service: {e}")

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["wasp", "start"]
        env = os.environ.copy()
        # Set DATABASE_URL if not already set, using the local postgres
        if "DATABASE_URL" not in env:
            env["DATABASE_URL"] = "postgresql://postgres:postgres@127.0.0.1:5432/wasp_db"
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180

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
    try:
        # Set database env for migration
        env = os.environ.copy()
        if "DATABASE_URL" not in env:
            env["DATABASE_URL"] = "postgresql://postgres:postgres@127.0.0.1:5432/wasp_db"

        # Run db migration before starting the app
        subprocess.run(["wasp", "db", "migrate-dev", "--name", "init"], cwd=PROJECT_DIR, env=env, check=True)
        xprocess.ensure(Starter.name, Starter)
    except Exception as e:
        print(f"Startup failed: {e}")
        raise e
    yield
    info.terminate()

def test_task_verification(start_app, browser_verifier):
    reason = "E-commerce checkout must handle discount codes and concurrent inventory updates transactionally."
    truth = "Navigate to http://127.0.0.1:3000. Add item to cart, apply coupon code, verify discount, initiate concurrent checkout to purchase the last item, and verify that one request succeeds while the other is rejected with a clear out-of-stock error."
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_task_verification"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
