import os
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter
from playwright.sync_api import sync_playwright

PROJECT_DIR = "/home/user/storage-migration"
PORT = 4173
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so the dev/preview server would listen on ::1 only while an
# AF_INET socket to 127.0.0.1 never connects -> the readiness check would hang.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Build the Vite app, then serve the production build with `vite preview`."""
    build = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    print("============================== [BUILD] stdout ==============================")
    print(build.stdout)
    print("============================== [BUILD] stderr ==============================")
    print(build.stderr)
    assert build.returncode == 0, f"`npm run build` failed with code {build.returncode}."

    class Starter(ProcessStarter):
        name = "preview"
        args = ["npm", "run", "preview", "--", "--port", str(PORT), "--host", HOST]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 120
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
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        try:
            with open(info.logpath, "r") as f:
                all_lines = f.readlines()
        except FileNotFoundError:
            return
        new_lines = all_lines[printed_log_lines:]
        printed_log_lines = len(all_lines)
        print(f"===================== [{tag}: Begin] preview logfile =====================")
        print("".join(new_lines))
        print(f"===================== [{tag}: End  ] preview logfile =====================")

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
def page(start_app):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        pg = context.new_page()
        try:
            yield pg
        finally:
            browser.close()


READ_STATE_JS = """() => ({
  'CapacitorStorage.fontSize': window.localStorage.getItem('CapacitorStorage.fontSize'),
  'CapacitorStorage.username': window.localStorage.getItem('CapacitorStorage.username'),
  'CapacitorStorage.theme': window.localStorage.getItem('CapacitorStorage.theme'),
  'CapacitorStorage.session_token': window.localStorage.getItem('CapacitorStorage.session_token'),
  'CapacitorStorage.extra': window.localStorage.getItem('CapacitorStorage.extra'),
  'legacy:theme': window.localStorage.getItem('legacy:theme'),
  'legacy:fontSize': window.localStorage.getItem('legacy:fontSize'),
  'legacy:username': window.localStorage.getItem('legacy:username'),
  'legacy:extra': window.localStorage.getItem('legacy:extra'),
  'session_token': window.localStorage.getItem('session_token'),
})"""


def test_migration_full_flow(page):
    # ---- Phase A: fresh migration ---------------------------------------
    page.goto(BASE_URL)
    page.wait_for_function("() => typeof window.migrateStorage === 'function'")

    # Seed legacy data, a pre-existing Preferences value (conflict), and a
    # non-prefixed key that must be ignored.
    page.evaluate(
        """() => {
            window.localStorage.clear();
            window.localStorage.setItem('legacy:theme', 'dark');
            window.localStorage.setItem('legacy:fontSize', '16');
            window.localStorage.setItem('legacy:username', 'alice');
            window.localStorage.setItem('CapacitorStorage.theme', 'light');
            window.localStorage.setItem('session_token', 'xyz');
        }"""
    )

    report = page.evaluate("async () => await window.migrateStorage()")
    assert isinstance(report, dict), f"migrateStorage() must resolve to an object, got: {report!r}"
    assert report.get("alreadyCompleted") is False, \
        f"On the first run alreadyCompleted must be false, got: {report.get('alreadyCompleted')!r}"

    migrated = report.get("migrated") or []
    skipped = report.get("skipped") or []
    assert "fontSize" in migrated, f"'fontSize' should be reported as migrated, got migrated={migrated}"
    assert "username" in migrated, f"'username' should be reported as migrated, got migrated={migrated}"
    assert "theme" not in migrated, f"'theme' must NOT be migrated (conflict), got migrated={migrated}"
    assert "theme" in skipped, f"'theme' should be reported as skipped due to conflict, got skipped={skipped}"

    state = page.evaluate(READ_STATE_JS)
    assert state["CapacitorStorage.fontSize"] == "16", \
        f"Preferences key 'fontSize' should be '16', got {state['CapacitorStorage.fontSize']!r}"
    assert state["CapacitorStorage.username"] == "alice", \
        f"Preferences key 'username' should be 'alice', got {state['CapacitorStorage.username']!r}"
    assert state["CapacitorStorage.theme"] == "light", \
        f"Preferences key 'theme' must stay 'light' (not overwritten), got {state['CapacitorStorage.theme']!r}"
    assert state["legacy:fontSize"] is None, \
        f"legacy:fontSize must be removed after migration, got {state['legacy:fontSize']!r}"
    assert state["legacy:username"] is None, \
        f"legacy:username must be removed after migration, got {state['legacy:username']!r}"
    assert state["legacy:theme"] == "dark", \
        f"legacy:theme must be kept (skipped, not migrated), got {state['legacy:theme']!r}"
    assert state["session_token"] == "xyz", \
        f"session_token (no legacy prefix) must be untouched, got {state['session_token']!r}"
    assert state["CapacitorStorage.session_token"] is None, \
        f"session_token must never be migrated, got {state['CapacitorStorage.session_token']!r}"

    # ---- Phase B: idempotency across a reload ---------------------------
    page.evaluate("() => window.localStorage.setItem('legacy:extra', 'new')")
    page.reload()
    page.wait_for_function("() => typeof window.migrateStorage === 'function'")

    report2 = page.evaluate("async () => await window.migrateStorage()")
    assert isinstance(report2, dict), f"migrateStorage() must resolve to an object, got: {report2!r}"
    assert report2.get("alreadyCompleted") is True, \
        f"After a completed migration alreadyCompleted must be true, got: {report2.get('alreadyCompleted')!r}"
    assert report2.get("migrated") == [], \
        f"A no-op run must report an empty migrated array, got: {report2.get('migrated')!r}"
    assert report2.get("skipped") == [], \
        f"A no-op run must report an empty skipped array, got: {report2.get('skipped')!r}"

    state2 = page.evaluate(READ_STATE_JS)
    assert state2["CapacitorStorage.extra"] is None, \
        f"'extra' must NOT be migrated once migration already completed, got {state2['CapacitorStorage.extra']!r}"
    assert state2["legacy:extra"] == "new", \
        f"legacy:extra must remain untouched after a no-op run, got {state2['legacy:extra']!r}"
