import os
import re
import socket
import time

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/csrf-app"
PORT = 5173
BASE = f"http://127.0.0.1:{PORT}"

TOKEN_INPUT_RE = re.compile(
    r"<input\b[^>]*\bname=[\"']csrf_token[\"'][^>]*>", re.IGNORECASE
)
VALUE_ATTR_RE = re.compile(r"\bvalue=[\"']([^\"']*)[\"']", re.IGNORECASE)


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Start the RedwoodSDK dev server and wait until it accepts connections."""

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "dev", "--", "--host", "127.0.0.1"]
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
        print(f"===================== [{tag}: Begin] {Starter.name} logfile =====================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"===================== [{tag}: End  ] {Starter.name} logfile =====================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    # The Vite dev server may open the port before it can serve compiled routes.
    # Poll GET / until it responds successfully.
    deadline = time.time() + 120
    last_err = None
    while time.time() < deadline:
        try:
            r = requests.get(BASE + "/", timeout=30)
            if r.status_code < 500:
                break
        except Exception as e:  # noqa: BLE001
            last_err = e
        time.sleep(2)
    else:
        capture_logs("NOT-READY")
        pytest.fail(f"App did not become ready on {BASE}. Last error: {last_err}")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def _get_token_from_html(html):
    m = TOKEN_INPUT_RE.search(html)
    if not m:
        return None
    v = VALUE_ATTR_RE.search(m.group(0))
    return v.group(1) if v else None


def _fetch_form_pair():
    """GET / and return (hidden_token, cookie_token, response)."""
    r = requests.get(BASE + "/", timeout=30)
    token = _get_token_from_html(r.text)
    cookie_token = r.cookies.get("csrf_token")
    return token, cookie_token, r


def test_index_embeds_token_and_sets_cookie(start_app):
    token, cookie_token, r = _fetch_form_pair()
    assert r.status_code == 200, f"GET / expected 200, got {r.status_code}"
    assert "<form" in r.text.lower(), "GET / response does not contain a <form> element."
    assert token, "GET / response does not contain a hidden input named 'csrf_token' with a value."
    assert cookie_token, "GET / response did not set a 'csrf_token' cookie."
    assert token == cookie_token, (
        f"Hidden token ({token!r}) must equal the csrf_token cookie ({cookie_token!r})."
    )


def test_token_is_fresh_per_request(start_app):
    token1, _, _ = _fetch_form_pair()
    token2, _, _ = _fetch_form_pair()
    assert token1 and token2, "Failed to read csrf tokens from two GET / requests."
    assert token1 != token2, (
        f"A new random token must be generated per request, but got the same value: {token1!r}"
    )


def test_valid_submission_is_accepted_and_persisted(start_app):
    token, cookie_token, _ = _fetch_form_pair()
    assert token and token == cookie_token, "Precondition failed: could not obtain a valid token pair."

    resp = requests.post(
        BASE + "/submit",
        data={"csrf_token": token, "message": "valid-msg-001"},
        headers={"Cookie": f"csrf_token={cookie_token}"},
        allow_redirects=False,
        timeout=30,
    )
    assert resp.status_code == 200, (
        f"Valid submission expected 200, got {resp.status_code}."
    )

    messages = requests.get(BASE + "/messages", timeout=30).json()
    assert isinstance(messages, list), "GET /messages must return a JSON array."
    assert "valid-msg-001" in messages, (
        f"Persisted messages should contain 'valid-msg-001', got: {messages}"
    )


def test_mismatched_token_is_rejected(start_app):
    token, cookie_token, _ = _fetch_form_pair()
    assert token and token == cookie_token, "Precondition failed: could not obtain a valid token pair."

    resp = requests.post(
        BASE + "/submit",
        data={"csrf_token": "totally-wrong", "message": "bad-msg-mismatch"},
        headers={"Cookie": f"csrf_token={cookie_token}"},
        allow_redirects=False,
        timeout=30,
    )
    assert resp.status_code == 403, (
        f"Mismatched CSRF token must be rejected with 403, got {resp.status_code}."
    )

    messages = requests.get(BASE + "/messages", timeout=30).json()
    assert "bad-msg-mismatch" not in messages, (
        f"Rejected submission must not be persisted, but found it: {messages}"
    )


def test_missing_cookie_is_rejected(start_app):
    token, cookie_token, _ = _fetch_form_pair()
    assert token and token == cookie_token, "Precondition failed: could not obtain a valid token pair."

    resp = requests.post(
        BASE + "/submit",
        data={"csrf_token": cookie_token, "message": "bad-msg-nocookie"},
        allow_redirects=False,
        timeout=30,
    )
    assert resp.status_code == 403, (
        f"Submission with no csrf_token cookie must be rejected with 403, got {resp.status_code}."
    )

    messages = requests.get(BASE + "/messages", timeout=30).json()
    assert "bad-msg-nocookie" not in messages, (
        f"Rejected submission must not be persisted, but found it: {messages}"
    )


def test_missing_form_token_is_rejected(start_app):
    token, cookie_token, _ = _fetch_form_pair()
    assert token and token == cookie_token, "Precondition failed: could not obtain a valid token pair."

    resp = requests.post(
        BASE + "/submit",
        data={"message": "bad-msg-notoken"},
        headers={"Cookie": f"csrf_token={cookie_token}"},
        allow_redirects=False,
        timeout=30,
    )
    assert resp.status_code == 403, (
        f"Submission without a csrf_token form field must be rejected with 403, got {resp.status_code}."
    )

    messages = requests.get(BASE + "/messages", timeout=30).json()
    assert "bad-msg-notoken" not in messages, (
        f"Rejected submission must not be persisted, but found it: {messages}"
    )


def test_messages_endpoint_shape(start_app):
    resp = requests.get(BASE + "/messages", timeout=30)
    assert resp.status_code == 200, f"GET /messages expected 200, got {resp.status_code}."
    content_type = resp.headers.get("content-type", "")
    assert "application/json" in content_type.lower(), (
        f"GET /messages must return application/json, got Content-Type: {content_type!r}"
    )
    body = resp.json()
    assert isinstance(body, list), "GET /messages body must be a JSON array."
    assert all(isinstance(m, str) for m in body), "GET /messages must be a JSON array of strings."
    assert "valid-msg-001" in body, "Expected the previously accepted message to be present."
    for bad in ("bad-msg-mismatch", "bad-msg-nocookie", "bad-msg-notoken"):
        assert bad not in body, f"Rejected message {bad!r} must never be persisted."
