import os
import socket
import time

import pytest
import requests
from pochi_verifier import PochiVerifier
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"
APP_HOST = "localhost"
APP_PORT = 5173
BASE_URL = f"http://{APP_HOST}:{APP_PORT}"


def _port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1.0)
        return s.connect_ex((host, port)) == 0


@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "rwsdk_dev_server"
        args = ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", str(APP_PORT)]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            return _port_open(APP_HOST, APP_PORT)

    xprocess.ensure(Starter.name, Starter)

    # Give Vite + miniflare a moment to fully initialize after the port opens.
    deadline = time.time() + 60
    while time.time() < deadline:
        try:
            r = requests.get(f"{BASE_URL}/api/count", timeout=5)
            if r.status_code < 500:
                break
        except requests.RequestException:
            pass
        time.sleep(1)

    yield

    info = xprocess.getinfo(Starter.name)
    info.terminate()


@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()


def test_initial_count_is_zero(start_app):
    """Verification step 1: GET /api/count should return {\"count\": 0} initially."""
    response = requests.get(f"{BASE_URL}/api/count", timeout=10)
    assert response.status_code == 200, (
        f"Expected 200 from GET /api/count, got {response.status_code}: {response.text}"
    )
    content_type = response.headers.get("Content-Type", "")
    assert "application/json" in content_type, (
        f"Expected Content-Type to include application/json, got: {content_type}"
    )
    body = response.json()
    assert body == {"count": 0}, (
        f"Expected initial body {{'count': 0}}, got: {body}"
    )


def test_counter_page_has_client_hydration_script(start_app):
    """Verification step 2: GET / should include a script tag for /src/client.tsx."""
    response = requests.get(f"{BASE_URL}/", timeout=10)
    assert response.status_code == 200, (
        f"Expected 200 from GET /, got {response.status_code}: {response.text[:500]}"
    )
    body = response.text
    assert "/src/client.tsx" in body, (
        "Expected the Document to include a script tag with src '/src/client.tsx' "
        "for client hydration; otherwise useSyncedState buttons will not work."
    )


def test_two_tab_realtime_sync(start_app, browser_verifier):
    """Verification step 3: drive two tabs in the same browser session and verify sync."""
    reason = (
        "Two open tabs of the counter page must stay in sync via useSyncedState. "
        "Clicking Increment in one tab must update the count in the other tab "
        "without a manual refresh."
    )
    truth = (
        f"Open {BASE_URL}/ in a tab (call it tab A). Verify the page shows a numeric "
        "count display whose value is 0, plus an 'Increment' button and a 'Decrement' "
        "button. Click 'Increment' 3 times in tab A. Verify the count display in tab "
        f"A now shows 3. Open {BASE_URL}/ in a second tab (tab B) using the same "
        "browser context. Verify the count display in tab B also shows 3 without you "
        "clicking anything in tab B. In tab B, click 'Decrement' once. Verify the "
        "count display in tab B shows 2. Switch back to tab A and verify, without "
        "refreshing, that the count display in tab A now also shows 2."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_two_tab_realtime_sync",
    )
    assert result.status == "pass", (
        f"Browser verification failed: {getattr(result, 'reason', '')}"
    )


def test_final_count_via_api(start_app):
    """Verification step 4: after browser interaction, GET /api/count returns {\"count\": 2}."""
    response = requests.get(f"{BASE_URL}/api/count", timeout=10)
    assert response.status_code == 200, (
        f"Expected 200 from GET /api/count, got {response.status_code}: {response.text}"
    )
    body = response.json()
    assert body == {"count": 2}, (
        f"Expected final body {{'count': 2}} after browser interactions, got: {body}"
    )
