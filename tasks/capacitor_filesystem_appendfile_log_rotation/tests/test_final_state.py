import os
import socket
import subprocess

import pytest
import requests
from playwright.sync_api import sync_playwright
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"
PORT = 4173
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so the preview server may listen on ::1 only while an
# AF_INET socket to 127.0.0.1 never connects -> the readiness check would hang.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}/"


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Build the app, then start the Vite preview server via xprocess."""
    build = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    print("============================== [BUILD stdout] ==============================")
    print(build.stdout)
    print("============================== [BUILD stderr] ==============================")
    print(build.stderr)
    assert build.returncode == 0, f"'npm run build' failed with code {build.returncode}."

    class Starter(ProcessStarter):
        name = "preview_app"
        args = [
            "npm", "run", "preview", "--",
            "--port", str(PORT),
            "--host", HOST,
            "--strictPort",
        ]
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
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        with open(info.logpath, "r") as f:
            lines = f.readlines()
        new = lines[printed:]
        printed = len(lines)
        print(f"====================== [{tag}] {Starter.name} log ======================")
        print("".join(new))

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield BASE_URL

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def page(start_app):
    """A single browser page/context so IndexedDB (Filesystem web storage) persists."""
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        context = browser.new_context()
        pg = context.new_page()
        pg.on("console", lambda msg: print(f"[browser console] {msg.type}: {msg.text}"))
        pg.on("pageerror", lambda err: print(f"[browser pageerror] {err}"))
        pg.goto(start_app, wait_until="load")
        pg.wait_for_function(
            "() => window.rollingLog "
            "&& typeof window.rollingLog.configure === 'function' "
            "&& typeof window.rollingLog.append === 'function' "
            "&& typeof window.rollingLog.readAll === 'function' "
            "&& typeof window.rollingLog.archives === 'function'",
            timeout=15000,
        )
        yield pg
        context.close()
        browser.close()


def _configure(page, max_bytes, max_archives):
    page.evaluate(
        "async (opts) => { await window.rollingLog.configure(opts); }",
        {"maxBytes": max_bytes, "maxArchives": max_archives},
    )


def _append_lines(page, lines):
    page.evaluate(
        "async (lines) => { for (const l of lines) { await window.rollingLog.append(l); } }",
        lines,
    )


def _read_all(page):
    return page.evaluate("async () => await window.rollingLog.readAll()")


def _archives(page):
    return page.evaluate("async () => await window.rollingLog.archives()")


def _reload_and_wait(page, url):
    page.goto(url, wait_until="load")
    page.wait_for_function(
        "() => window.rollingLog && typeof window.rollingLog.readAll === 'function'",
        timeout=15000,
    )


def test_api_surface(page):
    """Step 1: window.rollingLog exposes the required async methods."""
    present = page.evaluate(
        "() => !!window.rollingLog "
        "&& typeof window.rollingLog.configure === 'function' "
        "&& typeof window.rollingLog.append === 'function' "
        "&& typeof window.rollingLog.readAll === 'function' "
        "&& typeof window.rollingLog.archives === 'function'"
    )
    assert present, "window.rollingLog must expose configure, append, readAll and archives functions."


def test_rotation_retention_order(page):
    """Step 2: rotation, retention (drop oldest), and ordered read across files."""
    _configure(page, 30, 2)
    _append_lines(page, [f"line-{i:04d}" for i in range(1, 11)])

    archives = _archives(page)
    sizes = {a["name"]: a["size"] for a in archives}
    assert len(archives) == 2, f"Expected exactly 2 archive files, got {archives}."
    assert sizes.get("app.1.log") == 30, f"Expected app.1.log size 30, got {sizes}."
    assert sizes.get("app.2.log") == 30, f"Expected app.2.log size 30, got {sizes}."

    read = _read_all(page)
    expected = [
        "line-0004", "line-0005", "line-0006",
        "line-0007", "line-0008", "line-0009", "line-0010",
    ]
    assert read == expected, (
        f"readAll must return the retained lines oldest-first with the three "
        f"oldest records dropped. Expected {expected}, got {read}."
    )


def test_persistence_across_reload(page):
    """Step 3: retained data survives a page reload (persisted via Filesystem/IndexedDB)."""
    _reload_and_wait(page, BASE_URL)
    read = _read_all(page)
    expected = [
        "line-0004", "line-0005", "line-0006",
        "line-0007", "line-0008", "line-0009", "line-0010",
    ]
    assert read == expected, (
        f"After reload (without reconfiguring), readAll must still return the "
        f"persisted lines {expected}, got {read}. Data must be stored via the "
        f"Filesystem plugin, not only in memory."
    )


def test_configurable_threshold_no_premature_rotation(page):
    """Step 4: configure clears state, larger threshold avoids premature rotation."""
    _configure(page, 100, 5)
    _append_lines(page, [f"line-{i:04d}" for i in range(1, 6)])

    archives = _archives(page)
    assert archives == [], (
        f"With a 100-byte threshold and only 50 bytes written, no rotation "
        f"should occur and prior data must be cleared. Expected no archives, got {archives}."
    )

    read = _read_all(page)
    expected = ["line-0001", "line-0002", "line-0003", "line-0004", "line-0005"]
    assert read == expected, f"Expected {expected}, got {read}."


def test_single_archive_retention_with_oversized_records(page):
    """Step 5: maxArchives=1 keeps a single archive; oversized records each go to their own file."""
    _configure(page, 5, 1)
    _append_lines(page, ["line-0001", "line-0002", "line-0003"])

    archives = _archives(page)
    sizes = {a["name"]: a["size"] for a in archives}
    assert len(archives) == 1, f"Expected exactly 1 archive file, got {archives}."
    assert sizes.get("app.1.log") == 10, f"Expected app.1.log size 10, got {sizes}."

    read = _read_all(page)
    expected = ["line-0002", "line-0003"]
    assert read == expected, (
        f"With a single retained archive, only the two most recent records must "
        f"remain in order. Expected {expected}, got {read}."
    )
