import os
import shutil
import socket
import time

import pytest
import requests
from pochi_verifier import PochiVerifier
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"
PORT = 5173
BASE_URL = f"http://localhost:{PORT}"
API_URL = f"{BASE_URL}/api/todos"


def _wait_for_http(url: str, timeout: float = 180.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(url, timeout=5)
            if r.status_code < 500:
                return True
        except requests.RequestException:
            pass
        time.sleep(2)
    return False


def _reset_wrangler_state() -> None:
    state_dir = os.path.join(PROJECT_DIR, ".wrangler", "state")
    if os.path.isdir(state_dir):
        shutil.rmtree(state_dir, ignore_errors=True)


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Start the rwsdk dev server with a fresh local KV namespace."""

    _reset_wrangler_state()

    class Starter(ProcessStarter):
        name = "rwsdk_dev"
        args = ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", str(PORT)]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 300
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex(("127.0.0.1", PORT)) != 0:
                    return False
            try:
                r = requests.get(BASE_URL + "/", timeout=5)
                return r.status_code < 500
            except requests.RequestException:
                return False

    xprocess.ensure(Starter.name, Starter)
    assert _wait_for_http(BASE_URL + "/"), "rwsdk dev server did not become ready in time."

    yield

    info = xprocess.getinfo(Starter.name)
    info.terminate()


def _get_todos_json() -> dict:
    r = requests.get(API_URL, timeout=10)
    assert r.status_code == 200, f"GET /api/todos returned {r.status_code}: {r.text}"
    assert "application/json" in r.headers.get("content-type", ""), (
        f"GET /api/todos must return application/json, got {r.headers.get('content-type')}"
    )
    return r.json()


def test_step1_initial_empty_state(start_app):
    """The KV store starts empty; the JSON endpoint reports no todos."""
    data = _get_todos_json()
    assert isinstance(data, dict), f"Expected JSON object, got {type(data).__name__}"
    assert "todos" in data, "Response missing 'todos' field."
    assert "remaining" in data, "Response missing 'remaining' field."
    assert data["todos"] == [], f"Expected empty todos list, got {data['todos']!r}"
    assert data["remaining"] == 0, f"Expected remaining=0, got {data['remaining']!r}"


def test_step2_add_three_todos_via_browser(start_app):
    """Add three todos via the browser and verify they render with remaining=3."""
    reason = (
        "The home page must let the user add new todos via a server-rendered HTML form "
        "wired to a rwsdk serverAction. Adding three todos must persist them and "
        "re-render the page server-side with the new items and updated remaining count."
    )
    truth = (
        f"Navigate to {BASE_URL}/. Locate the text input with aria-label='New todo title' "
        "and submit the form three times in order with these titles: 'Buy milk', "
        "'Walk the dog', 'Write report'. After each submission the page should reload "
        "server-side. After all three submissions, verify the page contains exactly "
        "three elements with attribute data-testid='todo-title' whose visible text is "
        "'Buy milk', 'Walk the dog', 'Write report' in that order, and an element with "
        "attribute data-testid='remaining-count' whose text content is the digit '3'."
    )
    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_step2_add_three_todos",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_step3_kv_state_after_adds(start_app):
    """The JSON endpoint reflects the three added todos with done=false."""
    data = _get_todos_json()
    todos = data["todos"]
    assert len(todos) == 3, f"Expected 3 todos in KV, got {len(todos)}: {todos!r}"
    titles = [t["title"] for t in todos]
    assert titles == ["Buy milk", "Walk the dog", "Write report"], (
        f"Expected titles in insertion order ['Buy milk', 'Walk the dog', 'Write report'], "
        f"got {titles!r}"
    )
    for t in todos:
        assert isinstance(t.get("id"), str) and t["id"], f"Todo missing string id: {t!r}"
        assert isinstance(t.get("createdAt"), (int, float)), (
            f"Todo {t!r} missing numeric createdAt"
        )
        assert t.get("done") is False, f"Newly added todo should be done=false, got {t!r}"
    assert data["remaining"] == 3, f"Expected remaining=3, got {data['remaining']!r}"


def test_step4_toggle_one_via_browser(start_app):
    """Toggle 'Walk the dog' via the browser and verify UI reflects the change."""
    reason = (
        "Each todo row must expose a toggle form bound to a rwsdk serverAction that "
        "flips the done state. After toggling, the page must re-render with the row "
        "marked done and the remaining count decremented."
    )
    truth = (
        f"Navigate to {BASE_URL}/. Three todos should already be present: 'Buy milk', "
        "'Walk the dog', 'Write report'. Locate the toggle control whose aria-label is "
        "'Toggle Walk the dog' and submit the toggle form (check the checkbox; if it "
        "auto-submits on change, that is sufficient; otherwise click any associated "
        "submit button). After the page re-renders, verify the row for 'Walk the dog' "
        "has an ancestor element with attribute data-done='true', while the rows for "
        "'Buy milk' and 'Write report' have ancestor elements with data-done='false'. "
        "Verify the element with data-testid='remaining-count' now shows the digit '2'."
    )
    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_step4_toggle_one",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_step5_kv_state_after_toggle(start_app):
    """The JSON endpoint shows 'Walk the dog' as done=true; others remain false."""
    data = _get_todos_json()
    by_title = {t["title"]: t for t in data["todos"]}
    assert set(by_title.keys()) == {"Buy milk", "Walk the dog", "Write report"}, (
        f"Unexpected titles after toggle: {list(by_title.keys())!r}"
    )
    assert by_title["Walk the dog"]["done"] is True, (
        f"'Walk the dog' should be done=true, got {by_title['Walk the dog']!r}"
    )
    assert by_title["Buy milk"]["done"] is False, (
        f"'Buy milk' should remain done=false, got {by_title['Buy milk']!r}"
    )
    assert by_title["Write report"]["done"] is False, (
        f"'Write report' should remain done=false, got {by_title['Write report']!r}"
    )
    assert data["remaining"] == 2, f"Expected remaining=2, got {data['remaining']!r}"


def test_step6_delete_one_via_browser(start_app):
    """Delete 'Buy milk' via the browser and verify it disappears from the UI."""
    reason = (
        "Each todo row must expose a delete form bound to a rwsdk serverAction that "
        "removes the todo from KV. After deletion the page must re-render without that row."
    )
    truth = (
        f"Navigate to {BASE_URL}/. The page should currently list three todos: "
        "'Buy milk' (not done), 'Walk the dog' (done), 'Write report' (not done). "
        "Locate and click the button whose aria-label is 'Delete Buy milk'. After the "
        "page re-renders, verify the page contains exactly two elements with attribute "
        "data-testid='todo-title' whose visible text is 'Walk the dog' and 'Write report' "
        "in that order. Verify the element with data-testid='remaining-count' shows the "
        "digit '1'."
    )
    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_step6_delete_one",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_step7_kv_state_after_delete(start_app):
    """The JSON endpoint shows only the remaining two todos with correct done flags."""
    data = _get_todos_json()
    todos = data["todos"]
    assert len(todos) == 2, f"Expected 2 todos after delete, got {len(todos)}: {todos!r}"
    titles = [t["title"] for t in todos]
    assert titles == ["Walk the dog", "Write report"], (
        f"Expected ['Walk the dog', 'Write report'] (by createdAt asc), got {titles!r}"
    )
    by_title = {t["title"]: t for t in todos}
    assert by_title["Walk the dog"]["done"] is True, (
        f"'Walk the dog' should be done=true, got {by_title['Walk the dog']!r}"
    )
    assert by_title["Write report"]["done"] is False, (
        f"'Write report' should remain done=false, got {by_title['Write report']!r}"
    )
    assert data["remaining"] == 1, f"Expected remaining=1, got {data['remaining']!r}"
