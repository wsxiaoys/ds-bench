import os
import socket

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myapp"


@pytest.fixture(scope="session")
def app_port():
    """Finds and yields a free port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))  # Bind to any available port
        port = s.getsockname()[1]  # Get the assigned port
        yield port


@pytest.fixture(scope="session")
def start_app(xprocess, app_port):
    class Starter(ProcessStarter):
        name = "rwsdk_dev"
        args = ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", str(app_port)]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("127.0.0.1", app_port)) == 0

    pid, logpath = xprocess.ensure(Starter.name, Starter)

    # print the logs after the service has started
    with open(logpath, "r") as f:
        logs = f.read()
        print("=== Begin: Captured xprocess logfile after started =============================")
        print(logs)
        print("===== End: Captured xprocess logfile after started =============================")

    yield

    # teardown: print the logs and terminate the service
    with open(logpath, "r") as f:
        logs = f.read()
        print("=== Begin: Captured xprocess logfile when teardown =============================")
        print(logs)
        print("===== End: Captured xprocess logfile when teardown =============================")

    info = xprocess.getinfo(Starter.name)
    info.terminate()


def test_users_crud_flow(start_app, app_port):
    base_url = f"http://localhost:{app_port}"
    r0 = requests.get(f"{base_url}/api/users", timeout=30)
    assert r0.status_code == 200, f"initial GET /api/users {r0.status_code}: {r0.text[:200]}"
    assert r0.json() == {"users": []}, f"Expected empty users list, got {r0.json()}"

    r1 = requests.post(
        f"{base_url}/api/users",
        json={"name": "Alice", "email": "a@example.com"},
        timeout=30,
    )
    assert r1.status_code == 201, f"POST expected 201, got {r1.status_code}: {r1.text[:200]}"
    user = r1.json()
    assert user.get("name") == "Alice", f"unexpected: {user}"
    assert user.get("email") == "a@example.com", f"unexpected: {user}"
    alice_id = user.get("id")
    assert isinstance(alice_id, str) and alice_id, f"missing id: {user}"

    r2 = requests.post(f"{base_url}/api/users", json={}, timeout=30)
    assert r2.status_code == 400, f"POST {{}} expected 400, got {r2.status_code}"
    assert r2.json() == {"error": "invalid payload"}, f"bad error body: {r2.text}"

    r3 = requests.get(f"{base_url}/api/users/{alice_id}", timeout=30)
    assert r3.status_code == 200
    g = r3.json()
    assert g.get("name") == "Alice" and g.get("email") == "a@example.com", f"{g}"

    r4 = requests.get(f"{base_url}/api/users/not-real-id", timeout=30)
    assert r4.status_code == 404, f"GET not-real-id expected 404, got {r4.status_code}"
    assert r4.json() == {"error": "not found"}

    r5 = requests.put(
        f"{base_url}/api/users/{alice_id}",
        json={"name": "Alice2"},
        timeout=30,
    )
    assert r5.status_code == 200, f"PUT got {r5.status_code}: {r5.text[:200]}"
    upd = r5.json()
    assert upd.get("name") == "Alice2" and upd.get("email") == "a@example.com", f"{upd}"

    r6 = requests.delete(f"{base_url}/api/users/{alice_id}", timeout=30)
    assert r6.status_code == 204, f"DELETE got {r6.status_code}"

    r7 = requests.delete(f"{base_url}/api/users/{alice_id}", timeout=30)
    assert r7.status_code == 404, f"second DELETE expected 404, got {r7.status_code}"

    r8 = requests.get(f"{base_url}/api/users", timeout=30)
    assert r8.json() == {"users": []}, f"final list should be empty: {r8.json()}"
