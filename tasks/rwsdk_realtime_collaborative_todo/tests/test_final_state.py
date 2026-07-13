import os
import socket
import urllib.request

import pytest
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/project"
PORT = 5173
BASE_URL = f"http://127.0.0.1:{PORT}/"

# Realtime propagation can take a moment across two clients.
SYNC_TIMEOUT_MS = 20000


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Start the RedwoodSDK dev server (Vite + Cloudflare plugin) via xprocess."""

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "dev", "--", "--host", "127.0.0.1"]
        # CRITICAL: set `env` as a class attribute here, NEVER inside `popen_kwargs`.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("127.0.0.1", PORT)) == 0

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        try:
            with open(info.logpath, "r") as f:
                all_lines = f.readlines()
        except FileNotFoundError:
            all_lines = []
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
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


def _warm_up():
    """Issue a first request so the Vite/Cloudflare dev server finishes building."""
    last_err = None
    import time

    for _ in range(60):
        try:
            with urllib.request.urlopen(BASE_URL, timeout=10) as resp:
                if resp.status == 200:
                    return
        except Exception as e:  # noqa: BLE001
            last_err = e
        time.sleep(2)
    raise AssertionError(f"App did not become ready at {BASE_URL}: {last_err}")


def _item_texts(page):
    items = page.get_by_test_id("todo-item")
    return [t.strip() for t in items.all_inner_texts()]


def test_realtime_collaborative_todo(start_app):
    _warm_up()

    from playwright.sync_api import expect, sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            # Two independent clients.
            context_a = browser.new_context()
            context_b = browser.new_context()
            page_a = context_a.new_page()
            page_b = context_b.new_page()

            page_a.goto(BASE_URL, wait_until="networkidle")
            page_b.goto(BASE_URL, wait_until="networkidle")

            # Page must expose the required interactive controls (hydrated client component).
            expect(page_a.get_by_test_id("todo-input")).to_be_visible(timeout=SYNC_TIMEOUT_MS)
            expect(page_a.get_by_test_id("todo-add")).to_be_visible(timeout=SYNC_TIMEOUT_MS)
            expect(page_b.get_by_test_id("todo-input")).to_be_visible(timeout=SYNC_TIMEOUT_MS)

            # A adds an item -> must appear on B in realtime (no reload of B).
            page_a.get_by_test_id("todo-input").fill("Buy milk")
            page_a.get_by_test_id("todo-add").click()
            expect(
                page_b.get_by_test_id("todo-item").filter(has_text="Buy milk")
            ).to_have_count(1, timeout=SYNC_TIMEOUT_MS)

            # B adds an item -> must appear on A in realtime (bidirectional).
            page_b.get_by_test_id("todo-input").fill("Walk the dog")
            page_b.get_by_test_id("todo-add").click()
            expect(
                page_a.get_by_test_id("todo-item").filter(has_text="Walk the dog")
            ).to_have_count(1, timeout=SYNC_TIMEOUT_MS)

            # Both clients converge on exactly the two items.
            expect(page_a.get_by_test_id("todo-item")).to_have_count(2, timeout=SYNC_TIMEOUT_MS)
            expect(page_b.get_by_test_id("todo-item")).to_have_count(2, timeout=SYNC_TIMEOUT_MS)

            texts_a = set(_item_texts(page_a))
            texts_b = set(_item_texts(page_b))
            assert texts_a == {"Buy milk", "Walk the dog"}, (
                f"Client A expected items {{'Buy milk', 'Walk the dog'}}, got {texts_a}"
            )
            assert texts_b == {"Buy milk", "Walk the dog"}, (
                f"Client B expected items {{'Buy milk', 'Walk the dog'}}, got {texts_b}"
            )

            # Late joiner: server is the source of truth, so a fresh client sees existing items.
            context_c = browser.new_context()
            page_c = context_c.new_page()
            page_c.goto(BASE_URL, wait_until="networkidle")
            expect(
                page_c.get_by_test_id("todo-item").filter(has_text="Buy milk")
            ).to_have_count(1, timeout=SYNC_TIMEOUT_MS)
            expect(
                page_c.get_by_test_id("todo-item").filter(has_text="Walk the dog")
            ).to_have_count(1, timeout=SYNC_TIMEOUT_MS)
            texts_c = set(_item_texts(page_c))
            assert texts_c == {"Buy milk", "Walk the dog"}, (
                f"Late-joining client C expected the existing items, got {texts_c}"
            )
        finally:
            browser.close()
