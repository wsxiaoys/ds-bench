import os
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/bankapp"
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), which can cause connections to 127.0.0.1 to hang.
HOST = "127.0.0.1"
SERVER_PORT = 3001
OPERATION_URL = f"http://{HOST}:{SERVER_PORT}/operations/transfer-funds"


def _transfer(payload: dict) -> requests.Response:
    """Call the Wasp `transferFunds` Action over its HTTP operations endpoint.

    Wasp serializes payloads with SuperJSON, so the args are wrapped in a
    top-level `json` field and the result is read back from the `json` field.
    """
    return requests.post(OPERATION_URL, json={"json": payload}, timeout=30)


def _result(resp: requests.Response) -> dict:
    body = resp.json()
    assert "json" in body, f"Expected a SuperJSON response with a 'json' field, got: {body}"
    return body["json"]


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Seed the database to a known state and start the Wasp dev server."""
    # Reset the data to a deterministic starting point: Alice=100, Bob=50, empty ledger.
    seed = subprocess.run(
        ["wasp", "db", "seed"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    print("============================== [wasp db seed stdout] ==============================")
    print(seed.stdout)
    print("============================== [wasp db seed stderr] ==============================")
    print(seed.stderr)
    assert seed.returncode == 0, f"'wasp db seed' failed: {seed.stderr}"

    class Starter(ProcessStarter):
        name = "wasp_start"
        args = ["wasp", "start"]
        # CRITICAL: set `env` as a class attribute here, NEVER inside `popen_kwargs`.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 420
        terminate_on_interrupt = True

        def startup_check(self):
            # The Wasp server (operations API) listens on SERVER_PORT.
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, SERVER_PORT)) != 0:
                    return False
            # Confirm the HTTP server actually answers. Any response (even a 404
            # for GET on an operations route) proves the server is up.
            try:
                requests.get(f"http://{HOST}:{SERVER_PORT}/", timeout=20)
                return True
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        try:
            with open(info.logpath, "r") as f:
                lines = f.readlines()
        except FileNotFoundError:
            return
        new = lines[printed:]
        printed = len(lines)
        print(f"============================== [{tag}] {Starter.name} logfile ==============================")
        print("".join(new))
        print(f"============================== [{tag}: end] ==============================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def test_transfer_flow(start_app):
    # Step 1: Successful transfer Alice -> Bob of 30.
    r1 = _transfer({"from": "Alice", "to": "Bob", "amount": 30})
    assert r1.status_code == 200, f"Expected 200 for a valid transfer, got {r1.status_code}: {r1.text}"
    d1 = _result(r1)
    assert d1["from"]["balance"] == 70, f"Expected sender (Alice) balance 70 after transfer, got {d1['from']['balance']}"
    assert d1["to"]["balance"] == 80, f"Expected recipient (Bob) balance 80 after transfer, got {d1['to']['balance']}"
    assert d1["amount"] == 30, f"Expected echoed amount 30, got {d1['amount']}"
    assert d1["ledgerCount"] == 1, f"Expected ledgerCount 1 after first transfer, got {d1['ledgerCount']}"

    # Step 2: Insufficient funds must roll back and fail with HTTP 400.
    r2 = _transfer({"from": "Alice", "to": "Bob", "amount": 1000})
    assert r2.status_code == 400, (
        f"Expected HTTP 400 for an insufficient-funds transfer, got {r2.status_code}: {r2.text}"
    )

    # Step 3: Confirm the failed transfer changed nothing (rollback + atomicity).
    r3 = _transfer({"from": "Alice", "to": "Bob", "amount": 20})
    assert r3.status_code == 200, f"Expected 200 for a valid transfer, got {r3.status_code}: {r3.text}"
    d3 = _result(r3)
    assert d3["from"]["balance"] == 50, (
        f"Expected Alice balance 50 (proves the failed transfer did not debit), got {d3['from']['balance']}"
    )
    assert d3["to"]["balance"] == 100, f"Expected Bob balance 100, got {d3['to']['balance']}"
    assert d3["amount"] == 20, f"Expected echoed amount 20, got {d3['amount']}"
    assert d3["ledgerCount"] == 2, (
        f"Expected ledgerCount 2 (proves the failed transfer created no ledger record), got {d3['ledgerCount']}"
    )

    # Step 4: Reverse-direction transfer Bob -> Alice of 40.
    r4 = _transfer({"from": "Bob", "to": "Alice", "amount": 40})
    assert r4.status_code == 200, f"Expected 200 for a valid transfer, got {r4.status_code}: {r4.text}"
    d4 = _result(r4)
    assert d4["from"]["balance"] == 60, f"Expected Bob balance 60 after reverse transfer, got {d4['from']['balance']}"
    assert d4["to"]["balance"] == 90, f"Expected Alice balance 90 after reverse transfer, got {d4['to']['balance']}"
    assert d4["amount"] == 40, f"Expected echoed amount 40, got {d4['amount']}"
    assert d4["ledgerCount"] == 3, f"Expected ledgerCount 3 after third successful transfer, got {d4['ledgerCount']}"
