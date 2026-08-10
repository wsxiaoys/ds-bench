import os
import socket
import shutil

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"
EVENTS_LOG = os.path.join(PROJECT_DIR, "data", "events.log")
PORT = 3000
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so the dev server would listen on ::1 only while an
# AF_INET socket to 127.0.0.1 never connects -> the readiness check would hang.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

ORIGINAL_EVENTS = (
    "INFO|Server started\n"
    "INFO|Listening on port 3000\n"
    "WARN|High memory usage\n"
    "ERROR|Failed to connect to cache\n"
    "INFO|Retrying connection\n"
    "ERROR|Timeout while reading stream\n"
    "WARN|Slow response detected\n"
    "INFO|Shutdown complete\n"
)


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Start the Qwik City SSR dev server and wait until it is ready on PORT."""

    class Starter(ProcessStarter):
        name = "start_app"
        # Forward host/port flags to Vite so it binds the IPv4 loopback and the
        # fixed port the tests connect to.
        args = ["npm", "run", "dev", "--", "--host", HOST, "--port", str(PORT)]
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
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(BASE_URL, timeout=30)
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


def test_page_loads_without_server_error(start_app):
    """The route must respond with a non-error status (the SSR server itself must not crash)."""
    resp = requests.get(BASE_URL + "/", timeout=30)
    assert resp.status_code < 500, (
        f"GET {BASE_URL}/ returned {resp.status_code}; the app failed to serve the page."
    )


def test_stream_renders_incrementally_and_completes(start_app, browser_verifier):
    """Happy path + incremental delivery + no console errors + ordering/content."""
    reason = (
        "A Qwik City page uses an async-generator server$ RPC to stream parsed log "
        "entries from a local file to the browser, which renders them incrementally "
        "and keeps a live summary. It must work without runtime/console errors."
    )
    truth = (
        f"Open a browser to {BASE_URL}/ and open the developer console to watch for errors. "
        "Before clicking anything, verify the element with id 'status' shows exactly 'idle', "
        "the element with id 'count' shows '0', the element with id 'errors' shows '0', and "
        "the list with id 'events' has no <li> children. "
        "Then click the button with id 'start'. "
        "Verify the entries appear INCREMENTALLY over roughly a few seconds — i.e. list items "
        "under id 'events' are added one after another and the 'count' value increases step by "
        "step (it must NOT jump straight from 0 to the final total in a single update), and "
        "while entries are still arriving the 'status' element shows 'streaming'. "
        "Wait until the 'status' element shows exactly 'done'. "
        "After completion verify ALL of the following: the 'count' element shows exactly '8'; "
        "the 'errors' element shows exactly '2'; the 'events' list has exactly 8 <li> items; "
        "the items are ordered by their data-idx attribute as 0,1,2,3,4,5,6,7 with no duplicates; "
        "the item with data-idx='0' has data-level='INFO' and text 'INFO: Server started'; "
        "the item with data-idx='3' has data-level='ERROR' and text 'ERROR: Failed to connect to cache'; "
        "the item with data-idx='7' has data-level='INFO' and text 'INFO: Shutdown complete'. "
        "Finally verify that the browser console reported NO errors during the whole interaction "
        "(in particular no error about a module such as 'node:fs' being externalized for the "
        "browser, and no serialization error such as 'Code(3)' or 'Only primitive and object "
        "literals can be serialized'). "
        "The verification passes only if every one of these conditions holds."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_stream_renders_incrementally_and_completes",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_server_reads_local_file_roundtrip(start_app, browser_verifier):
    """The streamed data must genuinely come from the server reading the local file.

    Append a new line to the log on disk, then confirm the freshly streamed result
    reflects it — proving the server$ RPC re-reads the file server-side each call.
    """
    backup = ORIGINAL_EVENTS
    try:
        with open(EVENTS_LOG, "r") as f:
            backup = f.read()
        with open(EVENTS_LOG, "a") as f:
            if not backup.endswith("\n"):
                f.write("\n")
            f.write("ERROR|Injected line\n")

        reason = (
            "The server$ RPC must read the local data/events.log file on the server for "
            "every call, so appending a line on disk must be reflected in a new stream."
        )
        truth = (
            f"Open a browser to {BASE_URL}/ (reload the page to ensure a fresh load). "
            "Click the button with id 'start' and wait until the element with id 'status' "
            "shows exactly 'done'. Then verify ALL of the following: the 'count' element shows "
            "exactly '9'; the 'errors' element shows exactly '3'; the list with id 'events' has "
            "exactly 9 <li> items; the last item has data-idx='8', data-level='ERROR', and text "
            "'ERROR: Injected line'. The verification passes only if every condition holds."
        )
        result = browser_verifier.verify(
            reason=reason,
            truth=truth,
            use_browser_agent=True,
            trajectory_dir="/logs/verifier/pochi/test_server_reads_local_file_roundtrip",
        )
        assert result.status == "pass", f"Browser verification failed: {result.reason}"
    finally:
        with open(EVENTS_LOG, "w") as f:
            f.write(backup)
