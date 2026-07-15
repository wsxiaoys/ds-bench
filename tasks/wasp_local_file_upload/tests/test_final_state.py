import os
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/fileupload"
PORT = 3001
# Connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the IPv6
# loopback (::1), which would make an AF_INET readiness probe to 127.0.0.1 hang.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

FILE_CONTENT = b"Hello Wasp local upload!"
FILE_NAME = "notes.txt"
FILE_SIZE = len(FILE_CONTENT)  # 24

ALICE = {"username": "alice_zealt", "password": "Password123!"}
BOB = {"username": "bob_zealt", "password": "Password123!"}


def _bearer(session_id):
    return {"Authorization": f"Bearer {session_id}"}


@pytest.fixture(scope="session")
def start_app(xprocess):
    # Make sure the database schema is applied. This is idempotent: it only
    # creates a migration if schema.prisma changed, otherwise it reports the DB
    # is already in sync. Bounded by a timeout so it can never hang the suite.
    try:
        subprocess.run(
            ["wasp", "db", "migrate-dev", "--name", "verify_state"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=300,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"'wasp db migrate-dev' step skipped/failed: {exc}")

    class Starter(ProcessStarter):
        name = "wasp_app"
        args = ["wasp", "start"]
        # CRITICAL: set `env` as a class attribute, NEVER inside popen_kwargs.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 300
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                # Any non-5xx response means the server process is up. There is
                # no route at "/", so a 404 is an expected "ready" signal.
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
        skipped = printed
        printed = len(lines)
        print(f"===================== [{tag}: Begin] {Starter.name} log =====================")
        if skipped:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new))
        print(f"===================== [{tag}: End  ] {Starter.name} log =====================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def _signup_and_login(creds):
    signup = requests.post(f"{BASE_URL}/auth/username/signup", json=creds, timeout=30)
    assert signup.status_code in (200, 201, 204), (
        f"Signup for {creds['username']} failed: {signup.status_code} {signup.text}"
    )
    login = requests.post(f"{BASE_URL}/auth/username/login", json=creds, timeout=30)
    assert login.status_code == 200, (
        f"Login for {creds['username']} failed: {login.status_code} {login.text}"
    )
    body = login.json()
    session_id = body.get("sessionId")
    assert isinstance(session_id, str) and session_id, (
        f"Login response for {creds['username']} did not contain a sessionId: {body}"
    )
    return session_id


@pytest.fixture(scope="session")
def alice_session(start_app):
    return _signup_and_login(ALICE)


@pytest.fixture(scope="session")
def bob_session(start_app):
    return _signup_and_login(BOB)


@pytest.fixture(scope="session")
def uploaded_file_id(alice_session):
    """Upload a file as alice and return its id (used by later checks)."""
    resp = requests.post(
        f"{BASE_URL}/api/files/upload",
        headers=_bearer(alice_session),
        files={"file": (FILE_NAME, FILE_CONTENT, "text/plain")},
        timeout=30,
    )
    assert resp.status_code == 201, (
        f"Authenticated upload should return 201, got {resp.status_code}: {resp.text}"
    )
    data = resp.json()
    assert data.get("filename") == FILE_NAME, (
        f"Upload response filename should be '{FILE_NAME}', got: {data}"
    )
    assert data.get("size") == FILE_SIZE, (
        f"Upload response size should be {FILE_SIZE}, got: {data}"
    )
    file_id = data.get("id")
    assert file_id is not None, f"Upload response must contain an 'id', got: {data}"
    return file_id


def test_unauthenticated_upload_rejected(start_app):
    resp = requests.post(
        f"{BASE_URL}/api/files/upload",
        files={"file": (FILE_NAME, FILE_CONTENT, "text/plain")},
        timeout=30,
    )
    assert resp.status_code == 401, (
        f"Unauthenticated upload should return 401, got {resp.status_code}: {resp.text}"
    )


def test_authenticated_upload(uploaded_file_id):
    assert uploaded_file_id is not None, "Upload did not yield a file id."


def test_query_lists_only_owner_files(alice_session, bob_session, uploaded_file_id):
    # Alice sees exactly her uploaded file.
    resp = requests.post(
        f"{BASE_URL}/operations/get-my-files",
        headers=_bearer(alice_session),
        json={"json": {}},
        timeout=30,
    )
    assert resp.status_code == 200, (
        f"getMyFiles for alice should return 200, got {resp.status_code}: {resp.text}"
    )
    files = resp.json().get("json")
    assert isinstance(files, list), f"getMyFiles must return a list under 'json', got: {resp.json()}"
    assert len(files) == 1, f"Alice should have exactly 1 file, got: {files}"
    entry = files[0]
    assert entry.get("id") == uploaded_file_id, f"Listed file id mismatch: {entry}"
    assert entry.get("filename") == FILE_NAME, f"Listed file filename mismatch: {entry}"
    assert entry.get("size") == FILE_SIZE, f"Listed file size mismatch: {entry}"

    # Bob owns no files.
    resp_bob = requests.post(
        f"{BASE_URL}/operations/get-my-files",
        headers=_bearer(bob_session),
        json={"json": {}},
        timeout=30,
    )
    assert resp_bob.status_code == 200, (
        f"getMyFiles for bob should return 200, got {resp_bob.status_code}: {resp_bob.text}"
    )
    bob_files = resp_bob.json().get("json")
    assert bob_files == [], f"Bob should have no files, got: {bob_files}"


def test_owner_downloads_exact_bytes(alice_session, uploaded_file_id):
    resp = requests.get(
        f"{BASE_URL}/api/files/{uploaded_file_id}/download",
        headers=_bearer(alice_session),
        timeout=30,
    )
    assert resp.status_code == 200, (
        f"Owner download should return 200, got {resp.status_code}: {resp.text}"
    )
    assert resp.content == FILE_CONTENT, (
        f"Downloaded bytes should equal the uploaded content, got: {resp.content!r}"
    )


def test_download_requires_auth(start_app, uploaded_file_id):
    resp = requests.get(
        f"{BASE_URL}/api/files/{uploaded_file_id}/download",
        timeout=30,
    )
    assert resp.status_code == 401, (
        f"Unauthenticated download should return 401, got {resp.status_code}: {resp.text}"
    )


def test_download_enforces_ownership(bob_session, uploaded_file_id):
    resp = requests.get(
        f"{BASE_URL}/api/files/{uploaded_file_id}/download",
        headers=_bearer(bob_session),
        timeout=30,
    )
    assert resp.status_code == 403, (
        f"Downloading another user's file should return 403, got {resp.status_code}: {resp.text}"
    )


def test_download_missing_file_returns_404(alice_session):
    resp = requests.get(
        f"{BASE_URL}/api/files/99999999/download",
        headers=_bearer(alice_session),
        timeout=30,
    )
    assert resp.status_code == 404, (
        f"Downloading a non-existent file should return 404, got {resp.status_code}: {resp.text}"
    )
