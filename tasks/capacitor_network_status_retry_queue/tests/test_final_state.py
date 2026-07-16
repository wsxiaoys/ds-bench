import os
import socket
import time

import pytest
import requests
from playwright.sync_api import sync_playwright
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/network-queue-app"
PORT = 3000
# Connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the IPv6
# loopback (::1), so an AF_INET socket to 127.0.0.1 might never connect and the
# readiness check would hang for the full timeout.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"
RECEIVED_URL = f"{BASE_URL}/api/received"
RESET_URL = f"{BASE_URL}/api/reset"


# --------------------------------------------------------------------------- #
# API helpers (run from the pytest process, which is NOT network-emulated)
# --------------------------------------------------------------------------- #
def reset_api():
    resp = requests.post(RESET_URL, timeout=5)
    assert resp.status_code == 200, (
        f"POST /api/reset expected 200, got {resp.status_code}: {resp.text}"
    )


def get_received():
    resp = requests.get(RECEIVED_URL, timeout=5)
    assert resp.status_code == 200, (
        f"GET /api/received expected 200, got {resp.status_code}: {resp.text}"
    )
    data = resp.json()
    assert isinstance(data, dict) and "messages" in data, (
        f"GET /api/received must return an object with a 'messages' array, got: {data}"
    )
    return data["messages"]


def wait_for_received(predicate, timeout=20):
    deadline = time.time() + timeout
    last = []
    while time.time() < deadline:
        last = get_received()
        if predicate(last):
            return last
        time.sleep(0.3)
    return last


# --------------------------------------------------------------------------- #
# Browser helpers
# --------------------------------------------------------------------------- #
def open_page(browser):
    context = browser.new_context()
    page = context.new_page()
    page.goto(BASE_URL, wait_until="load")
    page.wait_for_function(
        "() => window.offlineQueue"
        " && typeof window.offlineQueue.submit === 'function'"
        " && typeof window.offlineQueue.pending === 'function'"
        " && typeof window.offlineQueue.connected === 'function'",
        timeout=20000,
    )
    return context, page


def submit(page, obj):
    # Fire-and-forget: we do not await the returned promise (its resolution
    # timing is implementation-defined). Observable effects are checked via
    # pending()/the API instead.
    page.evaluate("(o) => { window.offlineQueue.submit(o); }", obj)


def enqueue_offline(page, obj, expected_pending_len):
    """Submit while offline and wait until the item is buffered in the queue."""
    submit(page, obj)
    page.wait_for_function(
        "(n) => window.offlineQueue.pending().length === n",
        arg=expected_pending_len,
        timeout=10000,
    )


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "network_queue_app"
        args = ["npm", "start"]
        # CRITICAL: set env as a class attribute, never inside popen_kwargs.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 300
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
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        try:
            with open(info.logpath, "r") as f:
                lines = f.readlines()
        except OSError:
            lines = []
        new = lines[printed:]
        skipped = printed
        printed = len(lines)
        print(f"===== [{tag}: Begin] {Starter.name} log =====")
        if skipped:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new))
        print(f"===== [{tag}: End] {Starter.name} log =====")

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
def browser(start_app):
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        yield b
        b.close()


# --------------------------------------------------------------------------- #
# Tests
# --------------------------------------------------------------------------- #
def test_global_surface_and_initial_state(browser):
    reset_api()
    context, page = open_page(browser)
    try:
        connected = page.evaluate("() => window.offlineQueue.connected()")
        assert connected is True, (
            "While the browser is online, window.offlineQueue.connected() should return True, "
            f"got: {connected!r}"
        )
        pending = page.evaluate("() => window.offlineQueue.pending()")
        assert pending == [], (
            f"Expected an empty queue on a fresh page, got pending(): {pending!r}"
        )
    finally:
        context.close()


def test_immediate_send_when_online(browser):
    reset_api()
    context, page = open_page(browser)
    try:
        submit(page, {"id": "m-online", "body": "hello"})
        msgs = wait_for_received(
            lambda m: any(x["id"] == "m-online" for x in m), timeout=15
        )
        matches = [x for x in msgs if x["id"] == "m-online"]
        assert len(matches) == 1, (
            f"Expected exactly one delivered 'm-online' message while online, got: {msgs!r}"
        )
        assert matches[0]["body"] == "hello", (
            f"Expected delivered body 'hello', got: {matches[0]!r}"
        )
    finally:
        context.close()


def test_offline_buffering_and_fifo_flush(browser):
    reset_api()
    context, page = open_page(browser)
    try:
        context.set_offline(True)
        page.wait_for_function(
            "() => window.offlineQueue.connected() === false", timeout=15000
        )

        enqueue_offline(page, {"id": "a", "body": "1"}, 1)
        enqueue_offline(page, {"id": "b", "body": "2"}, 2)
        enqueue_offline(page, {"id": "c", "body": "3"}, 3)

        pending = page.evaluate("() => window.offlineQueue.pending()")
        assert pending == ["a", "b", "c"], (
            f"Expected queued ids in FIFO order ['a','b','c'], got: {pending!r}"
        )

        # Nothing should have been delivered while offline.
        assert get_received() == [], (
            "No messages should reach the API while the browser is offline, "
            f"but /api/received returned: {get_received()!r}"
        )

        # Reconnect -> networkStatusChange should flush the queue in FIFO order.
        context.set_offline(False)
        page.wait_for_function(
            "() => window.offlineQueue.connected() === true", timeout=15000
        )

        msgs = wait_for_received(lambda m: len(m) >= 3, timeout=25)
        delivered = [(x["id"], x["body"]) for x in msgs]
        assert delivered == [("a", "1"), ("b", "2"), ("c", "3")], (
            f"Expected FIFO flush order [a,b,c], got: {delivered!r}"
        )

        page.wait_for_function(
            "() => window.offlineQueue.pending().length === 0", timeout=10000
        )
    finally:
        context.close()


def test_deduplication_while_queued(browser):
    reset_api()
    context, page = open_page(browser)
    try:
        context.set_offline(True)
        page.wait_for_function(
            "() => window.offlineQueue.connected() === false", timeout=15000
        )

        enqueue_offline(page, {"id": "dup", "body": "x"}, 1)
        # Submitting an identical request must not add a second copy.
        submit(page, {"id": "dup", "body": "x"})
        page.wait_for_timeout(1500)
        pending = page.evaluate("() => window.offlineQueue.pending()")
        assert pending == ["dup"], (
            f"Identical queued requests must be de-duplicated; expected ['dup'], got: {pending!r}"
        )

        context.set_offline(False)
        page.wait_for_function(
            "() => window.offlineQueue.connected() === true", timeout=15000
        )

        msgs = wait_for_received(lambda m: len(m) >= 1, timeout=20)
        # Allow a little extra time to ensure no duplicate is delivered later.
        page.wait_for_timeout(1500)
        msgs = get_received()
        dup_msgs = [x for x in msgs if x["id"] == "dup"]
        assert len(dup_msgs) == 1, (
            f"Expected exactly one delivered 'dup' message after dedup, got: {msgs!r}"
        )
        assert dup_msgs[0]["body"] == "x", (
            f"Expected delivered body 'x' for 'dup', got: {dup_msgs[0]!r}"
        )
    finally:
        context.close()


def test_retry_with_backoff_on_transient_failure(browser):
    reset_api()
    context, page = open_page(browser)
    try:
        # The mock API returns 503 for the first two attempts of this id, then 200.
        submit(page, {"id": "flaky", "body": "z", "failTimes": 2})
        msgs = wait_for_received(
            lambda m: any(x["id"] == "flaky" for x in m), timeout=20
        )
        flaky = [x for x in msgs if x["id"] == "flaky"]
        assert len(flaky) == 1, (
            "Expected the transiently-failing request to be retried and delivered exactly once, "
            f"got: {msgs!r}"
        )
        assert flaky[0]["body"] == "z", (
            f"Expected delivered body 'z' for 'flaky', got: {flaky[0]!r}"
        )
    finally:
        context.close()
