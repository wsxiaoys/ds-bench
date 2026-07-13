import hashlib
import hmac
import os
import re
import socket
import time

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/webhook-app"
ENV_FILE = os.path.join(PROJECT_DIR, ".env")
PORT = 5173
BASE_URL = f"http://127.0.0.1:{PORT}"
WEBHOOK_URL = f"{BASE_URL}/webhook"


def load_secret() -> str:
    """Read the shared secret the worker uses from the project's .env file.

    RedwoodSDK exposes .env (linked to .dev.vars) as the worker's `env`, so the
    .env file is the single source of truth for WEBHOOK_SECRET. Fall back to the
    process environment if present.
    """
    if os.path.isfile(ENV_FILE):
        with open(ENV_FILE) as f:
            content = f.read()
        match = re.search(r"^\s*WEBHOOK_SECRET\s*=\s*(.+?)\s*$", content, re.MULTILINE)
        if match:
            value = match.group(1).strip().strip('"').strip("'")
            if value:
                return value
    return os.environ.get("WEBHOOK_SECRET", "")


SECRET = load_secret()


def sign(secret: str, body: bytes) -> str:
    """Compute the X-Signature-256 header value for a raw body."""
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def post_webhook(body: bytes, signature: str | None):
    headers = {"Content-Type": "application/json"}
    if signature is not None:
        headers["X-Signature-256"] = signature
    last_exc = None
    # Retry to absorb the RedwoodSDK/Vite first-request compilation latency.
    for _ in range(30):
        try:
            return requests.post(WEBHOOK_URL, data=body, headers=headers, timeout=30)
        except requests.exceptions.RequestException as exc:  # pragma: no cover
            last_exc = exc
            time.sleep(2)
    raise AssertionError(f"Could not reach {WEBHOOK_URL}: {last_exc}")


@pytest.fixture(scope="session")
def start_app(xprocess):
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


def test_secret_is_configured():
    assert SECRET, "WEBHOOK_SECRET environment variable is not set for the verifier."


def test_valid_signature_valid_payload(start_app):
    body = b'{"event":"order.created","items":[{"id":1},{"id":2},{"id":3}]}'
    resp = post_webhook(body, sign(SECRET, body))
    assert resp.status_code == 200, (
        f"Expected 200 for a valid signature, got {resp.status_code}: {resp.text}"
    )
    assert "application/json" in resp.headers.get("Content-Type", ""), (
        f"Expected Content-Type application/json, got {resp.headers.get('Content-Type')}"
    )
    data = resp.json()
    assert data == {"ok": True, "event": "order.created", "count": 3}, (
        f"Unexpected response body: {data}"
    )


def test_valid_signature_different_payload(start_app):
    body = b'{"event":"user.updated","items":[{"id":10}]}'
    resp = post_webhook(body, sign(SECRET, body))
    assert resp.status_code == 200, (
        f"Expected 200 for a valid signature, got {resp.status_code}: {resp.text}"
    )
    data = resp.json()
    assert data == {"ok": True, "event": "user.updated", "count": 1}, (
        f"Unexpected response body: {data}"
    )


def test_missing_signature_header(start_app):
    body = b'{"event":"order.created","items":[]}'
    resp = post_webhook(body, None)
    assert resp.status_code == 401, (
        f"Expected 401 when the X-Signature-256 header is missing, got {resp.status_code}: {resp.text}"
    )


def test_invalid_signature_wrong_secret(start_app):
    body = b'{"event":"order.created","items":[{"id":1}]}'
    wrong_signature = sign(SECRET + "tampered", body)
    resp = post_webhook(body, wrong_signature)
    assert resp.status_code == 401, (
        f"Expected 401 for a signature computed with the wrong secret, got {resp.status_code}: {resp.text}"
    )


def test_tampered_body(start_app):
    body_a = b'{"event":"order.created","items":[{"id":1}]}'
    body_b = b'{"event":"order.created","items":[{"id":1},{"id":2}]}'
    # Sign body A but send body B.
    resp = post_webhook(body_b, sign(SECRET, body_a))
    assert resp.status_code == 401, (
        f"Expected 401 when the body does not match the signed content, got {resp.status_code}: {resp.text}"
    )


def test_valid_signature_non_json_body(start_app):
    body = b"not-a-json-body"
    resp = post_webhook(body, sign(SECRET, body))
    assert resp.status_code == 400, (
        f"Expected 400 for a valid signature over a non-JSON body, got {resp.status_code}: {resp.text}"
    )
