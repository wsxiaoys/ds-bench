import os
import socket
import time

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/project"
PORT = 5173
BASE_URL = f"http://127.0.0.1:{PORT}"
DOWNLOAD_URL = f"{BASE_URL}/files/alphabet.txt"
MISSING_URL = f"{BASE_URL}/files/does-not-exist.txt"

FULL_BODY = "abcdefghijklmnopqrstuvwxyz"
REQUEST_TIMEOUT = 120


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Start the RedwoodSDK Vite dev server and wait until it accepts connections."""

    class Starter(ProcessStarter):
        name = "rwsdk_dev"
        args = ["npm", "run", "dev", "--", "--host", "127.0.0.1"]
        # CRITICAL: set `env` as a class attribute, NEVER inside `popen_kwargs`.
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
        with open(info.logpath, "r") as f:
            all_lines = f.readlines()
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

    # Warm up: the Vite dev server compiles on the first request, which may be slow.
    # Also triggers lazy seeding of the R2 fixture object.
    deadline = time.time() + 180
    last_err = None
    while time.time() < deadline:
        try:
            r = requests.get(DOWNLOAD_URL, timeout=REQUEST_TIMEOUT)
            if r.status_code in (200, 206, 404):
                break
        except requests.RequestException as e:  # noqa: PERF203
            last_err = e
        time.sleep(2)
    else:
        capture_logs("WARMUP_FAILED")
        pytest.fail(f"Dev server did not become ready for requests: {last_err}")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def test_full_download_no_range(start_app):
    resp = requests.get(DOWNLOAD_URL, timeout=REQUEST_TIMEOUT)
    assert resp.status_code == 200, (
        f"Expected status 200 for full download, got {resp.status_code}."
    )
    assert resp.text == FULL_BODY, (
        f"Expected full body '{FULL_BODY}', got '{resp.text}'."
    )
    assert resp.headers.get("Accept-Ranges", "").lower() == "bytes", (
        f"Expected 'Accept-Ranges: bytes', got '{resp.headers.get('Accept-Ranges')}'."
    )
    assert resp.headers.get("Content-Length") == "26", (
        f"Expected 'Content-Length: 26', got '{resp.headers.get('Content-Length')}'."
    )


def test_range_start_and_end(start_app):
    resp = requests.get(
        DOWNLOAD_URL, headers={"Range": "bytes=0-4"}, timeout=REQUEST_TIMEOUT
    )
    assert resp.status_code == 206, (
        f"Expected status 206 for ranged request, got {resp.status_code}."
    )
    assert resp.text == "abcde", f"Expected body 'abcde', got '{resp.text}'."
    assert resp.headers.get("Content-Range") == "bytes 0-4/26", (
        f"Expected 'Content-Range: bytes 0-4/26', got '{resp.headers.get('Content-Range')}'."
    )
    assert resp.headers.get("Content-Length") == "5", (
        f"Expected 'Content-Length: 5', got '{resp.headers.get('Content-Length')}'."
    )
    assert resp.headers.get("Accept-Ranges", "").lower() == "bytes", (
        f"Expected 'Accept-Ranges: bytes', got '{resp.headers.get('Accept-Ranges')}'."
    )


def test_range_middle(start_app):
    resp = requests.get(
        DOWNLOAD_URL, headers={"Range": "bytes=5-9"}, timeout=REQUEST_TIMEOUT
    )
    assert resp.status_code == 206, (
        f"Expected status 206 for ranged request, got {resp.status_code}."
    )
    assert resp.text == "fghij", f"Expected body 'fghij', got '{resp.text}'."
    assert resp.headers.get("Content-Range") == "bytes 5-9/26", (
        f"Expected 'Content-Range: bytes 5-9/26', got '{resp.headers.get('Content-Range')}'."
    )
    assert resp.headers.get("Content-Length") == "5", (
        f"Expected 'Content-Length: 5', got '{resp.headers.get('Content-Length')}'."
    )


def test_range_open_ended(start_app):
    resp = requests.get(
        DOWNLOAD_URL, headers={"Range": "bytes=20-"}, timeout=REQUEST_TIMEOUT
    )
    assert resp.status_code == 206, (
        f"Expected status 206 for open-ended range, got {resp.status_code}."
    )
    assert resp.text == "uvwxyz", f"Expected body 'uvwxyz', got '{resp.text}'."
    assert resp.headers.get("Content-Range") == "bytes 20-25/26", (
        f"Expected 'Content-Range: bytes 20-25/26', got '{resp.headers.get('Content-Range')}'."
    )
    assert resp.headers.get("Content-Length") == "6", (
        f"Expected 'Content-Length: 6', got '{resp.headers.get('Content-Length')}'."
    )


def test_range_suffix(start_app):
    resp = requests.get(
        DOWNLOAD_URL, headers={"Range": "bytes=-6"}, timeout=REQUEST_TIMEOUT
    )
    assert resp.status_code == 206, (
        f"Expected status 206 for suffix range, got {resp.status_code}."
    )
    assert resp.text == "uvwxyz", f"Expected body 'uvwxyz', got '{resp.text}'."
    assert resp.headers.get("Content-Range") == "bytes 20-25/26", (
        f"Expected 'Content-Range: bytes 20-25/26', got '{resp.headers.get('Content-Range')}'."
    )
    assert resp.headers.get("Content-Length") == "6", (
        f"Expected 'Content-Length: 6', got '{resp.headers.get('Content-Length')}'."
    )


def test_unknown_key_returns_404(start_app):
    resp = requests.get(MISSING_URL, timeout=REQUEST_TIMEOUT)
    assert resp.status_code == 404, (
        f"Expected status 404 for unknown key, got {resp.status_code}."
    )
