import os
import socket
import subprocess
import time

import pytest
import requests
import socketio
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/chatapp"
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), which can make readiness checks hang for the full timeout.
HOST = "127.0.0.1"
CLIENT_PORT = 3000  # React (Vite) dev server
SERVER_PORT = 3001  # Node server that also hosts the Socket.IO WebSocket endpoint
CLIENT_URL = f"http://{HOST}:{CLIENT_PORT}"
SERVER_URL = f"http://{HOST}:{SERVER_PORT}"

# Generous timeout: the very first `wasp start` compiles the app and installs
# dependencies inside .wasp/out before the servers come up.
STARTUP_TIMEOUT = 1200


def _port_open(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(2)
        return s.connect_ex((host, port)) == 0


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def start_app(xprocess):
    # Make sure the database schema is applied before starting the app. This is
    # idempotent: if the executor already created and applied a migration, Wasp
    # reports the schema is in sync and exits successfully.
    migrate = subprocess.run(
        ["wasp", "db", "migrate-dev", "--name", "chat"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    print("=== wasp db migrate-dev stdout ===")
    print(migrate.stdout)
    print("=== wasp db migrate-dev stderr ===")
    print(migrate.stderr)

    class Starter(ProcessStarter):
        name = "wasp_start"
        args = ["wasp", "start"]
        # CRITICAL: set `env` as a class attribute here, NEVER inside `popen_kwargs`.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = STARTUP_TIMEOUT
        terminate_on_interrupt = True

        def startup_check(self):
            # The WebSocket endpoint lives on the server port; the chat UI lives
            # on the client port. Require both to be up before running tests.
            if not _port_open(HOST, SERVER_PORT):
                return False
            if not _port_open(HOST, CLIENT_PORT):
                return False
            try:
                resp = requests.get(CLIENT_URL, timeout=20)
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
        except FileNotFoundError:
            lines = []
        new_lines = lines[printed:]
        printed = len(lines)
        print(f"====== [{tag}] wasp_start log ======")
        print("".join(new_lines))
        print(f"====== [{tag}] end wasp_start log ======")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def _make_client():
    return socketio.Client(reconnection=False, logger=False, engineio_logger=False)


def _connect(client):
    client.connect(SERVER_URL, wait=True, wait_timeout=30)
    # Give the server a brief moment to run its `connection` handler.
    time.sleep(1)


def _wait_for(predicate, timeout=20, interval=0.25):
    deadline = time.time() + timeout
    while time.time() < deadline:
        result = predicate()
        if result:
            return result
        time.sleep(interval)
    return predicate()


def test_broadcast_to_other_clients_and_sender(start_app):
    """Truth steps 1 & 2: a message sent by one client is broadcast to every
    connected client, including the sender."""
    client_a = _make_client()
    client_b = _make_client()
    received_a = []
    received_b = []
    client_a.on("newMessage", lambda data: received_a.append(data))
    client_b.on("newMessage", lambda data: received_b.append(data))

    try:
        _connect(client_a)
        _connect(client_b)

        client_a.emit("sendMessage", {"username": "alice", "text": "hello world"})

        def found_in(bucket):
            for msg in bucket:
                if isinstance(msg, dict) and msg.get("text") == "hello world":
                    return msg
            return None

        msg_b = _wait_for(lambda: found_in(received_b), timeout=20)
        assert msg_b is not None, (
            f"Client B did not receive a 'newMessage' broadcast for the sent message. "
            f"Received: {received_b}"
        )
        assert msg_b.get("username") == "alice", f"Broadcast username wrong: {msg_b}"
        assert str(msg_b.get("id", "")).strip() != "", f"Broadcast missing non-empty id: {msg_b}"
        assert str(msg_b.get("createdAt", "")).strip() != "", f"Broadcast missing non-empty createdAt: {msg_b}"

        msg_a = _wait_for(lambda: found_in(received_a), timeout=20)
        assert msg_a is not None, (
            f"Sender (client A) did not also receive the 'newMessage' broadcast. "
            f"Received: {received_a}"
        )
    finally:
        client_a.disconnect()
        client_b.disconnect()


def test_persistence_history_on_connect(start_app):
    """Truth step 3: a freshly connecting client receives the persisted message
    history, proving the previously sent message was saved to the database."""
    client_c = _make_client()
    history = []
    client_c.on("messageHistory", lambda data: history.append(data))

    try:
        _connect(client_c)

        def found_history():
            for payload in history:
                if isinstance(payload, list):
                    for msg in payload:
                        if isinstance(msg, dict) and msg.get("text") == "hello world" and msg.get("username") == "alice":
                            return msg
            return None

        found = _wait_for(found_history, timeout=20)
        assert found is not None, (
            f"New client did not receive a 'messageHistory' containing the persisted "
            f"message (username=alice, text='hello world'). Received: {history}"
        )
    finally:
        client_c.disconnect()


def test_history_ordering_oldest_first(start_app):
    """Truth step 4: message history is ordered oldest-first."""
    sender = _make_client()
    got = []
    sender.on("newMessage", lambda data: got.append(data))

    try:
        _connect(sender)

        def received_text(text):
            return any(isinstance(m, dict) and m.get("text") == text for m in got)

        sender.emit("sendMessage", {"username": "bob", "text": "first"})
        assert _wait_for(lambda: received_text("first"), timeout=20), "Did not get broadcast for 'first'."
        sender.emit("sendMessage", {"username": "bob", "text": "second"})
        assert _wait_for(lambda: received_text("second"), timeout=20), "Did not get broadcast for 'second'."
    finally:
        sender.disconnect()

    reader = _make_client()
    history = []
    reader.on("messageHistory", lambda data: history.append(data))
    try:
        _connect(reader)

        def get_texts():
            for payload in history:
                if isinstance(payload, list) and payload:
                    return [m.get("text") for m in payload if isinstance(m, dict)]
            return None

        texts = _wait_for(lambda: get_texts() if get_texts() else None, timeout=20)
        assert texts is not None, f"Reader did not receive a non-empty 'messageHistory'. Got: {history}"
        assert "first" in texts and "second" in texts, f"History missing expected messages: {texts}"
        assert texts.index("first") < texts.index("second"), (
            f"History is not ordered oldest-first: {texts}"
        )
    finally:
        reader.disconnect()


def test_chat_page_renders_and_sends_in_browser(start_app, browser_verifier):
    """Truth steps 5 & 6: the chat page renders existing messages (username and
    text) with a connection-status indicator, and a message typed and submitted
    in the browser appears in the on-page list without a reload."""
    reason = (
        "The app must serve a real-time chat page at the root route that connects over "
        "WebSockets, shows a connection status indicator, renders received messages with "
        "their username and text, and lets the user send a new message that appears live."
    )
    truth = (
        f"Navigate to {CLIENT_URL}/. Verify the page shows a chat UI with a connection "
        "status indicator (for example a connected/disconnected icon or label). Verify that "
        "previously sent messages are rendered so that both the username 'alice' and the text "
        "'hello world' are visible on the page. Then find the message text input, type the "
        "username 'carol' (in the username field if one exists) and the message 'live message from browser', "
        "and submit it. Verify that 'live message from browser' appears in the on-page message "
        "list without reloading the page."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_chat_page_renders_and_sends_in_browser",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
