import base64
import hashlib
import hmac
import json
import os
import socket
import subprocess
import time

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/jwt-api"
# The Wasp Node server (which serves custom `api` endpoints) listens on 3001.
# Connect over IPv4 explicitly: on Node 17+ `localhost` can resolve to the IPv6
# loopback (::1) while the server binds 127.0.0.1, causing readiness checks to hang.
HOST = "127.0.0.1"
PORT = 3001
BASE_URL = f"http://{HOST}:{PORT}"

TOKEN_URL = f"{BASE_URL}/auth/token"
ME_URL = f"{BASE_URL}/api/secure/me"

# Seeded member credentials (as required by the task).
SEED_USERNAME = "alice"
SEED_PASSWORD = "Sup3rSecret-Pw"

# The JWT secret. The verifier is authoritative: it injects this exact value into
# every Wasp subprocess (via the environment, which the Wasp server inherits) and
# uses the same value to craft/verify tokens, so the app and the verifier always
# agree regardless of how the platform provisions secrets. Falls back to a fixed
# local value (>=32 chars) when the environment does not provide one.
SECRET = os.environ.get("API_JWT_SECRET") or "harbor-local-jwt-secret-value-0123456789"


# --------------------------------------------------------------------------
# Minimal stdlib HS256 JWT helpers (no third-party dependency required).
# --------------------------------------------------------------------------
def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def make_jwt(payload: dict, secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_seg = _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    payload_seg = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_seg}.{payload_seg}".encode("ascii")
    signature = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    return f"{header_seg}.{payload_seg}.{_b64url_encode(signature)}"


def decode_and_verify(token: str, secret: str) -> dict:
    """Verify an HS256 JWT signature and return (header, payload)."""
    parts = token.split(".")
    assert len(parts) == 3, f"Token is not a well-formed JWT: {token!r}"
    header_seg, payload_seg, signature_seg = parts
    header = json.loads(_b64url_decode(header_seg))
    payload = json.loads(_b64url_decode(payload_seg))
    signing_input = f"{header_seg}.{payload_seg}".encode("ascii")
    expected_sig = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    actual_sig = _b64url_decode(signature_seg)
    assert hmac.compare_digest(expected_sig, actual_sig), (
        "The issued token's signature does not verify against API_JWT_SECRET "
        "using HS256."
    )
    return {"header": header, "payload": payload}


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# --------------------------------------------------------------------------
# App lifecycle
# --------------------------------------------------------------------------
@pytest.fixture(scope="session")
def start_app(xprocess):
    assert SECRET, "API_JWT_SECRET is not set in the environment."

    env = os.environ.copy()
    # The Wasp server inherits this; shell env vars take precedence over .env files.
    env["API_JWT_SECRET"] = SECRET

    # Apply pending migrations non-interactively so the schema exists.
    migrate = subprocess.run(
        ["wasp", "db", "migrate-dev", "--name", "verify"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        env=env,
        timeout=900,
    )
    print("=== wasp db migrate-dev stdout ===\n" + migrate.stdout)
    print("=== wasp db migrate-dev stderr ===\n" + migrate.stderr)

    # Seed the database (seed must be idempotent per the task requirements).
    seed = subprocess.run(
        ["wasp", "db", "seed"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        env=env,
        timeout=600,
    )
    print("=== wasp db seed stdout ===\n" + seed.stdout)
    print("=== wasp db seed stderr ===\n" + seed.stderr)

    class Starter(ProcessStarter):
        name = "wasp_app"
        args = ["wasp", "start"]
        env = {**os.environ, "API_JWT_SECRET": SECRET}
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 600
        terminate_on_interrupt = True
        max_read_lines = 500000

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            # Port open; confirm the token endpoint actually responds so we don't
            # begin tests before the server routes are mounted.
            try:
                resp = requests.post(
                    TOKEN_URL,
                    json={"username": SEED_USERNAME, "password": SEED_PASSWORD},
                    timeout=20,
                )
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
        printed = len(lines)
        print(f"===== [{tag}] wasp start log =====")
        print("".join(new))
        print(f"===== [{tag}] end wasp start log =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    # Give the server a brief moment to settle after first response.
    time.sleep(2)

    yield

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def member_id(start_app):
    """Log in with valid credentials and return the member id from the token."""
    resp = requests.post(
        TOKEN_URL,
        json={"username": SEED_USERNAME, "password": SEED_PASSWORD},
        timeout=30,
    )
    assert resp.status_code == 200, (
        f"POST /auth/token with valid credentials should return 200, "
        f"got {resp.status_code}: {resp.text}"
    )
    body = resp.json()
    assert isinstance(body, dict) and isinstance(body.get("token"), str), (
        f"Response must be a JSON object with a string 'token' field, got: {body}"
    )
    decoded = decode_and_verify(body["token"], SECRET)
    assert decoded["header"].get("alg") == "HS256", (
        f"Token must be signed with HS256, got header: {decoded['header']}"
    )
    payload = decoded["payload"]
    assert "exp" in payload, f"Token payload must contain an 'exp' claim: {payload}"
    assert float(payload["exp"]) > time.time(), (
        f"Token 'exp' must be in the future, got: {payload.get('exp')}"
    )
    assert "sub" in payload, f"Token payload must contain a 'sub' claim: {payload}"
    return int(payload["sub"])


# --------------------------------------------------------------------------
# Happy path
# --------------------------------------------------------------------------
def test_valid_login_returns_token(start_app):
    resp = requests.post(
        TOKEN_URL,
        json={"username": SEED_USERNAME, "password": SEED_PASSWORD},
        timeout=30,
    )
    assert resp.status_code == 200, (
        f"Valid credentials should return 200, got {resp.status_code}: {resp.text}"
    )
    body = resp.json()
    assert isinstance(body.get("token"), str) and body["token"], (
        f"Successful login must return a non-empty string 'token', got: {body}"
    )


def test_protected_me_with_valid_token(start_app, member_id):
    login = requests.post(
        TOKEN_URL,
        json={"username": SEED_USERNAME, "password": SEED_PASSWORD},
        timeout=30,
    )
    token = login.json()["token"]

    resp = requests.get(ME_URL, headers=auth_header(token), timeout=30)
    assert resp.status_code == 200, (
        f"GET /api/secure/me with a valid token should return 200, "
        f"got {resp.status_code}: {resp.text}"
    )
    body = resp.json()
    assert int(body.get("id")) == member_id, (
        f"/api/secure/me must return the authenticated member's id ({member_id}), "
        f"got: {body}"
    )
    assert body.get("username") == SEED_USERNAME, (
        f"/api/secure/me must return username '{SEED_USERNAME}', got: {body}"
    )


# --------------------------------------------------------------------------
# Invalid credentials
# --------------------------------------------------------------------------
def test_wrong_password_rejected(start_app):
    resp = requests.post(
        TOKEN_URL,
        json={"username": SEED_USERNAME, "password": "wrong-password"},
        timeout=30,
    )
    assert resp.status_code == 401, (
        f"Wrong password should return 401, got {resp.status_code}: {resp.text}"
    )


def test_unknown_user_rejected(start_app):
    resp = requests.post(
        TOKEN_URL,
        json={"username": "nobody", "password": SEED_PASSWORD},
        timeout=30,
    )
    assert resp.status_code == 401, (
        f"Unknown username should return 401, got {resp.status_code}: {resp.text}"
    )


# --------------------------------------------------------------------------
# Protected route rejection cases
# --------------------------------------------------------------------------
def test_missing_authorization_header_rejected(start_app):
    resp = requests.get(ME_URL, timeout=30)
    assert resp.status_code == 401, (
        f"Missing Authorization header should return 401, "
        f"got {resp.status_code}: {resp.text}"
    )


def test_malformed_token_rejected(start_app):
    resp = requests.get(
        ME_URL, headers={"Authorization": "Bearer not-a-real-jwt"}, timeout=30
    )
    assert resp.status_code == 401, (
        f"Malformed token should return 401, got {resp.status_code}: {resp.text}"
    )


def test_tampered_token_rejected(start_app):
    login = requests.post(
        TOKEN_URL,
        json={"username": SEED_USERNAME, "password": SEED_PASSWORD},
        timeout=30,
    )
    token = login.json()["token"]
    # Flip the final signature character so the signature no longer matches.
    last = token[-1]
    replacement = "0" if last != "0" else "1"
    tampered = token[:-1] + replacement

    resp = requests.get(ME_URL, headers=auth_header(tampered), timeout=30)
    assert resp.status_code == 401, (
        f"Tampered token should return 401, got {resp.status_code}: {resp.text}"
    )


def test_expired_token_rejected(start_app, member_id):
    # Correctly signed with the real secret, but already expired.
    payload = {"sub": member_id, "exp": int(time.time()) - 3600}
    expired = make_jwt(payload, SECRET)

    resp = requests.get(ME_URL, headers=auth_header(expired), timeout=30)
    assert resp.status_code == 401, (
        f"Expired token should return 401, got {resp.status_code}: {resp.text}"
    )


def test_wrong_secret_token_rejected(start_app, member_id):
    # Well-formed and not expired, but signed with a different secret.
    payload = {"sub": member_id, "exp": int(time.time()) + 3600}
    forged = make_jwt(payload, "totally-wrong-secret-value")

    resp = requests.get(ME_URL, headers=auth_header(forged), timeout=30)
    assert resp.status_code == 401, (
        f"Token signed with the wrong secret should return 401, "
        f"got {resp.status_code}: {resp.text}"
    )
