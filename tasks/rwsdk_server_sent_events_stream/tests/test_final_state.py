import json
import os
import socket

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/app"
PORT = 5173
BASE_URL = f"http://127.0.0.1:{PORT}"
SSE_URL = f"{BASE_URL}/sse"


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Start the RedwoodSDK dev server and wait until port 5173 is accepting connections."""

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


def _parse_sse(body):
    """Parse a raw SSE body into a list of event dicts.

    Each event dict maps field names (e.g. 'id', 'event') to their value, with the
    combined 'data' field stored under the 'data' key.
    """
    events = []
    # Events are separated by a blank line (\n\n). Normalize CRLF just in case.
    normalized = body.replace("\r\n", "\n").strip("\n")
    if not normalized:
        return events
    for block in normalized.split("\n\n"):
        block = block.strip("\n")
        if not block.strip():
            continue
        fields = {}
        data_lines = []
        for line in block.split("\n"):
            if line.startswith(":"):
                # comment line
                continue
            if ":" in line:
                field, _, value = line.partition(":")
                if value.startswith(" "):
                    value = value[1:]
            else:
                field, value = line, ""
            if field == "data":
                data_lines.append(value)
            else:
                fields[field] = value
        fields["data"] = "\n".join(data_lines)
        events.append(fields)
    return events


@pytest.fixture(scope="session")
def sse_result(start_app):
    """Fetch the SSE endpoint once and share the response with all tests.

    Because the endpoint must close the stream on its own, reading the full body
    to EOF must complete without a client-side abort.
    """
    resp = requests.get(SSE_URL, stream=False, timeout=90)
    body = resp.text
    return {
        "status": resp.status_code,
        "headers": {k.lower(): v for k, v in resp.headers.items()},
        "body": body,
        "events": _parse_sse(body),
    }


def test_status_code(sse_result):
    assert sse_result["status"] == 200, (
        f"Expected GET /sse to return HTTP 200, got {sse_result['status']}."
    )


def test_content_type_header(sse_result):
    ctype = sse_result["headers"].get("content-type", "")
    assert "text/event-stream" in ctype.lower(), (
        f"Expected Content-Type to contain 'text/event-stream', got '{ctype}'."
    )


def test_cache_control_header(sse_result):
    cache_control = sse_result["headers"].get("cache-control", "")
    assert "no-cache" in cache_control.lower(), (
        f"Expected Cache-Control to be 'no-cache', got '{cache_control}'."
    )


def test_connection_header(sse_result):
    connection = sse_result["headers"].get("connection", "")
    assert "keep-alive" in connection.lower(), (
        f"Expected Connection to be 'keep-alive', got '{connection}'."
    )


def test_stream_terminates_on_its_own(sse_result):
    # Reaching this point means requests read the full body to EOF within the
    # timeout without a client abort, proving the server closed the stream.
    assert sse_result["body"], "Expected a non-empty SSE response body."


def test_total_event_count(sse_result):
    events = sse_result["events"]
    assert len(events) == 6, (
        f"Expected exactly 6 events (5 message events + 1 terminal 'done' event), "
        f"got {len(events)}: {events}"
    )


def test_message_events_payloads(sse_result):
    events = sse_result["events"]
    assert len(events) >= 5, (
        f"Expected at least 5 message events, got {len(events)}: {events}"
    )
    for n in range(5):
        event = events[n]
        assert event.get("id") == str(n), (
            f"Expected event {n} to have 'id: {n}', got id='{event.get('id')}' in {event}"
        )
        raw_data = event.get("data", "")
        try:
            parsed = json.loads(raw_data)
        except json.JSONDecodeError as exc:
            pytest.fail(f"Event {n} data is not valid JSON: {raw_data!r} ({exc})")
        assert parsed == {"index": n, "message": f"tick-{n}"}, (
            f"Expected event {n} data to equal "
            f'{{"index": {n}, "message": "tick-{n}"}}, got {parsed!r}'
        )


def test_terminal_done_event(sse_result):
    events = sse_result["events"]
    assert len(events) == 6, (
        f"Expected a terminal event as the 6th event, got {len(events)} events."
    )
    terminal = events[5]
    assert terminal.get("event") == "done", (
        f"Expected the terminal event to have 'event: done', got {terminal!r}"
    )
    assert terminal.get("data") == "[DONE]", (
        f"Expected the terminal event data to be '[DONE]', got {terminal.get('data')!r}"
    )
