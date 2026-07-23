import os
import socket
import secrets
import subprocess
import time

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/kanban"
HOST = "127.0.0.1"
SERVER_PORT = 3001
CLIENT_PORT = 3000
SERVER_URL = f"http://{HOST}:{SERVER_PORT}"
CLIENT_URL = f"http://{HOST}:{CLIENT_PORT}"
PASSWORD = "Password123!"


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _run_id_suffix():
    """Build a collision-safe suffix from run-id (if present) + random token."""
    run_id = ""
    try:
        with open("/logs/artifacts/run-id") as f:
            run_id = "".join(c for c in f.read().strip() if c.isalnum()).lower()
    except OSError:
        run_id = ""
    return f"{run_id}{secrets.token_hex(4)}"


def _wait_for_port(host, port, timeout=600):
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex((host, port)) == 0:
                return True
        time.sleep(1)
    return False


def _op_url(operation_route):
    return f"{SERVER_URL}/operations/{operation_route}"


def _extract(resp):
    """Wasp operations use the superjson envelope: read the `json` field."""
    body = resp.json()
    if isinstance(body, dict) and "json" in body:
        return body["json"]
    return body


def _call_op(operation_route, token, payload):
    """Call a Wasp operation over HTTP. Returns (status_code, extracted_result)."""
    headers = {"Content-Type": "application/json"}
    if token is not None:
        headers["Authorization"] = f"Bearer {token}"
    resp = requests.post(
        _op_url(operation_route),
        json={"json": payload},
        headers=headers,
        timeout=30,
    )
    result = None
    try:
        result = _extract(resp)
    except ValueError:
        result = None
    return resp.status_code, result


def _make_user(prefix):
    """Sign up and log in a fresh user. Returns (username, token)."""
    username = f"{prefix}{_run_id_suffix()}"
    signup = requests.post(
        f"{SERVER_URL}/auth/username/signup",
        json={"username": username, "password": PASSWORD},
        timeout=30,
    )
    assert signup.status_code < 400, (
        f"Signup for {username} failed: {signup.status_code} {signup.text}"
    )
    login = requests.post(
        f"{SERVER_URL}/auth/username/login",
        json={"username": username, "password": PASSWORD},
        timeout=30,
    )
    assert login.status_code < 400, (
        f"Login for {username} failed: {login.status_code} {login.text}"
    )
    body = login.json()
    token = body.get("sessionId") if isinstance(body, dict) else None
    assert token, f"Login response for {username} did not contain a sessionId: {body}"
    return username, token


def _create_column(token, title, position):
    status, result = _call_op("create-column", token, {"title": title, "position": position})
    assert status < 400, f"createColumn failed ({status}): {result}"
    assert isinstance(result, dict) and "id" in result, f"createColumn bad result: {result}"
    return result


def _create_card(token, title, column_id, position):
    status, result = _call_op(
        "create-card", token, {"title": title, "columnId": column_id, "position": position}
    )
    assert status < 400, f"createCard failed ({status}): {result}"
    assert isinstance(result, dict) and "id" in result, f"createCard bad result: {result}"
    return result


def _get_board(token):
    status, result = _call_op("get-board", token, {})
    assert status == 200, f"getBoard failed ({status}): {result}"
    assert isinstance(result, list), f"getBoard should return a list of columns, got: {result}"
    return result


def _find_card(board, card_id):
    for col in board:
        for card in col.get("cards", []):
            if card["id"] == card_id:
                return col, card
    return None, None


def _build_board(token):
    """Create a deterministic board owned by `token`'s user.

    col1 (pos 1.0): X(1.0), Y(2.0), Z(3.0)
    col2 (pos 2.0): W(1.0)
    col3 (pos 3.0): empty
    """
    col1 = _create_column(token, "To Do", 1.0)
    col2 = _create_column(token, "Doing", 2.0)
    col3 = _create_column(token, "Done", 3.0)
    x = _create_card(token, "X", col1["id"], 1.0)
    y = _create_card(token, "Y", col1["id"], 2.0)
    z = _create_card(token, "Z", col1["id"], 3.0)
    w = _create_card(token, "W", col2["id"], 1.0)
    return {
        "col1": col1["id"],
        "col2": col2["id"],
        "col3": col3["id"],
        "X": x["id"],
        "Y": y["id"],
        "Z": z["id"],
        "W": w["id"],
    }


# --------------------------------------------------------------------------- #
# App lifecycle fixture
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def start_app(xprocess):
    # Best-effort: make sure the schema is applied. If migrations already exist
    # this is a no-op; the stdin answer covers the case where a name is prompted.
    try:
        subprocess.run(
            ["wasp", "db", "migrate-dev"],
            cwd=PROJECT_DIR,
            input="verify\n",
            capture_output=True,
            text=True,
            timeout=300,
        )
    except subprocess.TimeoutExpired:
        pass

    class Starter(ProcessStarter):
        name = "wasp_app"
        args = ["wasp", "start"]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 600
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, SERVER_PORT)) != 0:
                    return False
            try:
                resp = requests.get(SERVER_URL, timeout=20)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        try:
            with open(info.logpath, "r") as f:
                lines = f.readlines()
        except OSError:
            lines = []
        new = lines[printed:]
        printed = len(lines)
        print(f"===== [{tag}] wasp_app log =====")
        print("".join(new))
        print(f"===== [{tag}] end wasp_app log =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield
    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


# --------------------------------------------------------------------------- #
# Tests
# --------------------------------------------------------------------------- #
def test_unauthenticated_get_board_rejected(start_app):
    status, _ = _call_op("get-board", None, {})
    assert status == 401, f"getBoard without a session must return 401, got {status}."


def test_midpoint_and_cross_column_move(start_app):
    _, token = _make_user("alice")
    ids = _build_board(token)

    status, moved = _call_op(
        "move-card",
        token,
        {
            "cardId": ids["W"],
            "targetColumnId": ids["col1"],
            "afterCardId": ids["X"],
            "beforeCardId": ids["Y"],
        },
    )
    assert status < 400, f"moveCard (midpoint) failed ({status}): {moved}"

    board = _get_board(token)
    _, w = _find_card(board, ids["W"])
    assert w is not None, "Card W not found after move."
    assert w["columnId"] == ids["col1"], (
        f"W should have moved to col1 ({ids['col1']}), got columnId={w['columnId']}."
    )
    assert w["position"] == 1.5, (
        f"W's new position must be the exact midpoint of 1.0 and 2.0 (=1.5), got {w['position']}."
    )

    # Siblings must not be renumbered.
    _, x = _find_card(board, ids["X"])
    _, y = _find_card(board, ids["Y"])
    _, z = _find_card(board, ids["Z"])
    assert x is not None and y is not None and z is not None, "Cards X/Y/Z missing after move."
    assert x["position"] == 1.0, f"X position changed: {x['position']}"
    assert y["position"] == 2.0, f"Y position changed: {y['position']}"
    assert z["position"] == 3.0, f"Z position changed: {z['position']}"


def test_get_board_ordering(start_app):
    _, token = _make_user("alice")
    ids = _build_board(token)
    _call_op(
        "move-card",
        token,
        {
            "cardId": ids["W"],
            "targetColumnId": ids["col1"],
            "afterCardId": ids["X"],
            "beforeCardId": ids["Y"],
        },
    )

    board = _get_board(token)
    # Columns ordered by position ascending.
    positions = [c["position"] for c in board]
    assert positions == sorted(positions), f"Columns not ordered by position ascending: {positions}"
    col_ids_in_order = [c["id"] for c in board]
    assert col_ids_in_order[:3] == [ids["col1"], ids["col2"], ids["col3"]], (
        f"Expected column order col1,col2,col3, got {col_ids_in_order}."
    )

    col1 = next(c for c in board if c["id"] == ids["col1"])
    card_positions = [c["position"] for c in col1["cards"]]
    assert card_positions == sorted(card_positions), (
        f"col1 cards not ordered by position ascending: {card_positions}"
    )
    ordered_ids = [c["id"] for c in col1["cards"]]
    assert ordered_ids == [ids["X"], ids["W"], ids["Y"], ids["Z"]], (
        f"Expected col1 card order X,W,Y,Z, got {ordered_ids}."
    )

    # Each card object exposes the required keys.
    for c in col1["cards"]:
        for key in ("id", "title", "position", "columnId"):
            assert key in c, f"Card object missing key '{key}': {c}"


def test_tail_move(start_app):
    _, token = _make_user("alice")
    ids = _build_board(token)

    status, moved = _call_op(
        "move-card",
        token,
        {"cardId": ids["X"], "targetColumnId": ids["col1"], "afterCardId": ids["Z"]},
    )
    assert status < 400, f"moveCard (tail) failed ({status}): {moved}"

    board = _get_board(token)
    col1 = next(c for c in board if c["id"] == ids["col1"])
    ordered_ids = [c["id"] for c in col1["cards"]]
    assert ordered_ids[-1] == ids["X"], f"X should be last in col1, order was {ordered_ids}."
    _, x = _find_card(board, ids["X"])
    assert x is not None, "Card X missing after tail move."
    assert x["position"] > 3.0, f"X (moved to tail after Z@3.0) must have position > 3.0, got {x['position']}."
    # Other cards untouched.
    _, y = _find_card(board, ids["Y"])
    _, z = _find_card(board, ids["Z"])
    assert y is not None and z is not None, "Cards Y/Z missing after tail move."
    assert y["position"] == 2.0 and z["position"] == 3.0, "Sibling positions must not change on a tail move."


def test_head_move(start_app):
    _, token = _make_user("alice")
    ids = _build_board(token)

    status, moved = _call_op(
        "move-card",
        token,
        {"cardId": ids["Z"], "targetColumnId": ids["col1"], "beforeCardId": ids["X"]},
    )
    assert status < 400, f"moveCard (head) failed ({status}): {moved}"

    board = _get_board(token)
    col1 = next(c for c in board if c["id"] == ids["col1"])
    ordered_ids = [c["id"] for c in col1["cards"]]
    assert ordered_ids[0] == ids["Z"], f"Z should be first in col1, order was {ordered_ids}."
    _, z = _find_card(board, ids["Z"])
    assert z is not None, "Card Z missing after head move."
    assert z["position"] < 1.0, f"Z (moved to head before X@1.0) must have position < 1.0, got {z['position']}."


def test_empty_column_move(start_app):
    _, token = _make_user("alice")
    ids = _build_board(token)

    status, moved = _call_op(
        "move-card",
        token,
        {"cardId": ids["Y"], "targetColumnId": ids["col3"]},
    )
    assert status < 400, f"moveCard (empty column) failed ({status}): {moved}"

    board = _get_board(token)
    _, y = _find_card(board, ids["Y"])
    assert y is not None and y["columnId"] == ids["col3"], (
        f"Y should now belong to the previously-empty col3 ({ids['col3']})."
    )
    col3 = next(c for c in board if c["id"] == ids["col3"])
    col3_ids = [c["id"] for c in col3["cards"]]
    assert col3_ids == [ids["Y"]], f"col3 should contain exactly Y, got {col3_ids}."


def test_ownership_enforcement(start_app):
    _, token_a = _make_user("alice")
    ids = _build_board(token_a)
    _, token_b = _make_user("bob")

    # User B tries to move user A's card.
    status_move, _ = _call_op(
        "move-card",
        token_b,
        {"cardId": ids["X"], "targetColumnId": ids["col1"]},
    )
    assert status_move in (403, 404), (
        f"Moving another user's card must be rejected with 403/404, got {status_move}."
    )

    # User B tries to create a card inside user A's column.
    status_create, _ = _call_op(
        "create-card",
        token_b,
        {"title": "intruder", "columnId": ids["col1"], "position": 9.0},
    )
    assert status_create in (403, 404), (
        f"Creating a card in another user's column must be rejected with 403/404, got {status_create}."
    )

    # Confirm no intruder card leaked into user A's board.
    board = _get_board(token_a)
    titles = [c["title"] for col in board for c in col.get("cards", [])]
    assert "intruder" not in titles, f"An intruder card leaked into user A's board: {titles}."
    total_cards = sum(len(col.get("cards", [])) for col in board)
    assert total_cards == 4, f"User A's board should still have exactly 4 cards, found {total_cards}."


def test_optimistic_update_wired_in_client(start_app):
    """Secondary, non-runtime check: the client must configure an optimistic
    update for moveCard against the getBoard query. This UI-timing behavior has
    no reliable headless runtime proxy, so it is checked via source inspection."""
    src_dir = os.path.join(PROJECT_DIR, "src")
    assert os.path.isdir(src_dir), f"Client source directory {src_dir} not found."
    combined = []
    for root, _dirs, files in os.walk(src_dir):
        for name in files:
            if name.endswith((".ts", ".tsx", ".js", ".jsx")):
                try:
                    with open(os.path.join(root, name), encoding="utf-8", errors="ignore") as f:
                        combined.append(f.read())
                except OSError:
                    pass
    text = "\n".join(combined)
    assert "optimisticUpdates" in text, (
        "Expected the client to configure `optimisticUpdates` for the move action."
    )
    assert "moveCard" in text, "Expected the client to reference the moveCard action."
    assert "getBoard" in text, "Expected the optimistic update to target the getBoard query."


def test_board_renders_in_browser(start_app, browser_verifier):
    assert _wait_for_port(HOST, CLIENT_PORT, timeout=600), (
        f"Web client never became reachable on {HOST}:{CLIENT_PORT}."
    )
    username, token = _make_user("web")
    col = _create_column(token, "ToDo", 1.0)
    _create_card(token, "Buy milk", col["id"], 1.0)

    reason = (
        "The app is an authenticated Kanban board. After logging in, the user's board "
        "should render its columns and cards."
    )
    truth = (
        f"Navigate to {CLIENT_URL}. You should be sent to a login page. "
        f"Log in with username '{username}' and password '{PASSWORD}'. "
        "After logging in, verify the board view renders and that a column titled 'ToDo' "
        "is visible and contains a card titled 'Buy milk'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_board_renders_in_browser",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
