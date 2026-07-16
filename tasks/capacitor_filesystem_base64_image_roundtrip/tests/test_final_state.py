import hashlib
import os
import socket

import pytest
import requests
from playwright.sync_api import sync_playwright
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/capacitor-fs-roundtrip"
ASSET_PATH = os.path.join(PROJECT_DIR, "public", "sample.png")
PORT = 4173
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so Vite would listen on ::1 only while an AF_INET socket to
# 127.0.0.1 never connects -> the readiness check would hang for the full timeout.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"


def _expected_asset_digest_and_size():
    with open(ASSET_PATH, "rb") as f:
        data = f.read()
    return hashlib.sha256(data).hexdigest(), len(data)


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Start the Vite dev server for the Capacitor web app."""

    class Starter(ProcessStarter):
        name = "start_app"
        # `--host 127.0.0.1` forces Vite to bind the IPv4 loopback so it matches the
        # address the readiness check and the browser connect to.
        args = ["npm", "run", "dev", "--", "--host", HOST, "--port", str(PORT)]
        # CRITICAL: set `env` as a class attribute here, NEVER inside `popen_kwargs`.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
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

    yield

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def page_results(start_app):
    """Load the app in a headless browser, wait for the round-trip to finish, and
    collect the rendered text of every result element."""
    ids = [
        "status",
        "original-hash",
        "readback-hash",
        "match",
        "byte-length",
        "write-uri",
        "dir-listing",
    ]
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            page.goto(BASE_URL, wait_until="load", timeout=60000)
            # Wait until the round-trip has populated the status element.
            page.wait_for_function(
                "() => { const el = document.querySelector('#status');"
                " return el && el.textContent && el.textContent.trim().length > 0; }",
                timeout=60000,
            )
            results = {}
            for element_id in ids:
                text = page.text_content(f"#{element_id}")
                results[element_id] = (text or "").strip()
        finally:
            browser.close()
    print("Collected page results:", results)
    return results


def test_status_ok(page_results):
    assert page_results["status"] == "OK", (
        f"Expected #status to be 'OK' (round-trip success), got '{page_results['status']}'."
    )


def test_original_hash_matches_asset(page_results):
    expected_hash, _ = _expected_asset_digest_and_size()
    assert page_results["original-hash"] == expected_hash, (
        f"#original-hash should equal SHA-256 of public/sample.png ({expected_hash}), "
        f"got '{page_results['original-hash']}'."
    )


def test_readback_integrity(page_results):
    expected_hash, _ = _expected_asset_digest_and_size()
    assert page_results["readback-hash"] == expected_hash, (
        f"#readback-hash should equal SHA-256 of the original asset ({expected_hash}), "
        f"got '{page_results['readback-hash']}'. The bytes read back were not byte-for-byte identical."
    )
    assert page_results["match"] == "true", (
        f"#match should be 'true' when original and read-back hashes are equal, got '{page_results['match']}'."
    )


def test_byte_length(page_results):
    _, expected_len = _expected_asset_digest_and_size()
    assert page_results["byte-length"] == str(expected_len), (
        f"#byte-length should equal the asset size ({expected_len} bytes), got '{page_results['byte-length']}'."
    )


def test_write_uri_location(page_results):
    write_uri = page_results["write-uri"]
    assert write_uri, "#write-uri is empty; Filesystem.writeFile did not return a uri."
    assert write_uri.endswith("images/roundtrip/sample.png"), (
        "#write-uri should end with 'images/roundtrip/sample.png' (written under Directory.Data), "
        f"got '{write_uri}'."
    )


def test_directory_listing_contains_file(page_results):
    listing = page_results["dir-listing"]
    entries = [item.strip() for item in listing.split(",") if item.strip()]
    assert "sample.png" in entries, (
        f"#dir-listing should include 'sample.png' from readdir of 'images/roundtrip', got '{listing}'."
    )
