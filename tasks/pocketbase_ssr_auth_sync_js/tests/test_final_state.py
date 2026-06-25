import os
import socket
import pytest
import requests
import json
import urllib.parse
import portpicker
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"
PB_URL = "http://127.0.0.1:8090"

@pytest.fixture(scope="session")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()

@pytest.fixture(scope="session")
def start_app(xprocess, app_port):
    class Starter(ProcessStarter):
        name = "start_app"
        args = ["node", "index.js", "--port", str(app_port)]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 10
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", app_port)) == 0

    info = xprocess.getinfo(Starter.name)

    def capture_logs(tag):
        with open(info.logpath, "r") as f:
            logs = f.read()
            print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
            print(logs)
            print(f"============================== [{tag}: End  ] Captured {Starter.name} logfile ==============================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()

def test_valid_token_request(start_app, app_port):
    # 1. Log in to PocketBase to get a valid token
    auth_resp = requests.post(
        f"{PB_URL}/api/collections/users/auth-with-password",
        json={"identity": "test@example.com", "password": "secure_password"},
        timeout=5
    )
    assert auth_resp.status_code == 200, f"Failed to login to PocketBase: {auth_resp.text}"
    auth_data = auth_resp.json()
    token = auth_data["token"]
    user_id = auth_data["record"]["id"]
    
    # 2. Construct the cookie string
    auth_store_state = {
        "token": token,
        "model": auth_data["record"]
    }
    cookie_val = urllib.parse.quote(json.dumps(auth_store_state))
    cookies = {"pb_auth": cookie_val}

    # 3. Request /profile
    resp = requests.get(f"http://localhost:{app_port}/profile", cookies=cookies, timeout=5)
    
    # 4. Verify response
    assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}. Body: {resp.text}"
    body = resp.json()
    assert body.get("id") == user_id, f"Expected user id {user_id}, got {body.get('id')}"
    assert body.get("email") == "test@example.com", f"Expected email test@example.com, got {body.get('email')}"
    
    # Verify Set-Cookie header
    set_cookie = resp.headers.get("Set-Cookie", "")
    assert "pb_auth=" in set_cookie, f"Expected Set-Cookie header with pb_auth, got: {set_cookie}"
    # The token should ideally be refreshed, so we just check it's present and not empty
    assert "pb_auth=;" not in set_cookie, "Set-Cookie header cleared the token instead of refreshing it"

def test_invalid_token_request(start_app, app_port):
    cookies = {"pb_auth": "invalid_token_string"}
    resp = requests.get(f"http://localhost:{app_port}/profile", cookies=cookies, timeout=5)
    
    assert resp.status_code == 401, f"Expected 401 Unauthorized, got {resp.status_code}"
    body = resp.json()
    assert body.get("error") == "Unauthorized", f"Expected error 'Unauthorized', got {body}"
    
    set_cookie = resp.headers.get("Set-Cookie", "")
    assert "pb_auth=" in set_cookie, "Expected Set-Cookie header to clear pb_auth"
    # Depending on how the cookie is cleared, it might be empty or expire in the past
    assert "pb_auth=;" in set_cookie or "Expires=" in set_cookie or "Max-Age=0" in set_cookie, \
        f"Expected Set-Cookie to clear the cookie, got: {set_cookie}"

def test_missing_token_request(start_app, app_port):
    resp = requests.get(f"http://localhost:{app_port}/profile", timeout=5)
    
    assert resp.status_code == 401, f"Expected 401 Unauthorized, got {resp.status_code}"
    body = resp.json()
    assert body.get("error") == "Unauthorized", f"Expected error 'Unauthorized', got {body}"
    
    set_cookie = resp.headers.get("Set-Cookie", "")
    assert "pb_auth=" in set_cookie, "Expected Set-Cookie header to clear pb_auth"
    assert "pb_auth=;" in set_cookie or "Expires=" in set_cookie or "Max-Age=0" in set_cookie, \
        f"Expected Set-Cookie to clear the cookie, got: {set_cookie}"
