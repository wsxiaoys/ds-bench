import os
import socket

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myapp"
BASE_URL = "http://localhost:5173"


@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "rwsdk_dev"
        args = ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("127.0.0.1", 5173)) == 0

    xprocess.ensure(Starter.name, Starter)
    yield
    info = xprocess.getinfo(Starter.name)
    info.terminate()


def test_users_crud_flow(start_app):
    r0 = requests.get(f"{BASE_URL}/api/users", timeout=30)
    assert r0.status_code == 200, f"initial GET /api/users {r0.status_code}: {r0.text[:200]}"
    assert r0.json() == {"users": []}, f"Expected empty users list, got {r0.json()}"

    r1 = requests.post(
        f"{BASE_URL}/api/users",
        json={"name": "Alice", "email": "a@example.com"},
        timeout=30,
    )
    assert r1.status_code == 201, f"POST expected 201, got {r1.status_code}: {r1.text[:200]}"
    user = r1.json()
    assert user.get("name") == "Alice", f"unexpected: {user}"
    assert user.get("email") == "a@example.com", f"unexpected: {user}"
    alice_id = user.get("id")
    assert isinstance(alice_id, str) and alice_id, f"missing id: {user}"

    r2 = requests.post(f"{BASE_URL}/api/users", json={}, timeout=30)
    assert r2.status_code == 400, f"POST {{}} expected 400, got {r2.status_code}"
    assert r2.json() == {"error": "invalid payload"}, f"bad error body: {r2.text}"

    r3 = requests.get(f"{BASE_URL}/api/users/{alice_id}", timeout=30)
    assert r3.status_code == 200
    g = r3.json()
    assert g.get("name") == "Alice" and g.get("email") == "a@example.com", f"{g}"

    r4 = requests.get(f"{BASE_URL}/api/users/not-real-id", timeout=30)
    assert r4.status_code == 404, f"GET not-real-id expected 404, got {r4.status_code}"
    assert r4.json() == {"error": "not found"}

    r5 = requests.put(
        f"{BASE_URL}/api/users/{alice_id}",
        json={"name": "Alice2"},
        timeout=30,
    )
    assert r5.status_code == 200, f"PUT got {r5.status_code}: {r5.text[:200]}"
    upd = r5.json()
    assert upd.get("name") == "Alice2" and upd.get("email") == "a@example.com", f"{upd}"

    r6 = requests.delete(f"{BASE_URL}/api/users/{alice_id}", timeout=30)
    assert r6.status_code == 204, f"DELETE got {r6.status_code}"

    r7 = requests.delete(f"{BASE_URL}/api/users/{alice_id}", timeout=30)
    assert r7.status_code == 404, f"second DELETE expected 404, got {r7.status_code}"

    r8 = requests.get(f"{BASE_URL}/api/users", timeout=30)
    assert r8.json() == {"users": []}, f"final list should be empty: {r8.json()}"
