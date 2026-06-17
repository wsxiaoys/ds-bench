import hashlib
import os
import shutil
import socket
import subprocess
import time
from datetime import datetime
from urllib.parse import quote

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"
BASE_URL = "http://localhost:5173"

# Deterministic 1x1 transparent PNG (67 bytes). The bytes are the standard
# minimal PNG referenced in the task's verification plan.
PNG_BYTES = bytes(
    [
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
        0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
        0x42, 0x60, 0x82,
    ]
)
EXPECTED_SHA256 = hashlib.sha256(PNG_BYTES).hexdigest()
EXPECTED_KEY = f"uploads/{EXPECTED_SHA256}.png"


def _wait_for_port(host: str, port: int, timeout: float) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(2.0)
            if s.connect_ex((host, port)) == 0:
                return True
        time.sleep(1.0)
    return False


def _wait_for_http(url: str, timeout: float) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            resp = requests.get(url, timeout=5)
            if resp.status_code < 500:
                return True
        except requests.RequestException:
            pass
        time.sleep(1.0)
    return False


@pytest.fixture(scope="session", autouse=True)
def reset_local_r2_state():
    """Remove any existing local Miniflare state so each run starts with an
    empty R2 bucket."""
    state_dir = os.path.join(PROJECT_DIR, ".wrangler", "state")
    if os.path.isdir(state_dir):
        shutil.rmtree(state_dir, ignore_errors=True)
    yield


@pytest.fixture(scope="session")
def app_server(xprocess, reset_local_r2_state):
    class Starter(ProcessStarter):
        name = "rwsdk_r2_dev_server"
        args = ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 300
        terminate_on_interrupt = True

        def startup_check(self):
            return _wait_for_port("localhost", 5173, timeout=2.0)

    xprocess.ensure(Starter.name, Starter)

    # Make sure the worker is actually serving HTTP, not just that the port is
    # open (Vite opens the port early but the worker may still be warming up).
    assert _wait_for_http(BASE_URL + "/api/files", timeout=240), (
        "Dev server did not start responding on http://localhost:5173 within 240s."
    )

    yield BASE_URL

    info = xprocess.getinfo(Starter.name)
    info.terminate()


def _list_objects(base_url: str):
    resp = requests.get(f"{base_url}/api/files", timeout=30)
    assert resp.status_code == 200, (
        f"GET /api/files expected 200, got {resp.status_code}: {resp.text!r}"
    )
    body = resp.json()
    assert isinstance(body, dict) and "objects" in body, (
        f"Listing response must be a JSON object with 'objects' key, got: {body!r}"
    )
    assert isinstance(body["objects"], list), (
        f"'objects' must be a JSON array, got: {body['objects']!r}"
    )
    return body["objects"]


def _delete_all(base_url: str):
    for obj in _list_objects(base_url):
        key = obj.get("key")
        if not key:
            continue
        requests.delete(f"{base_url}/api/files/{quote(key, safe='')}", timeout=30)


def test_empty_list_initially(app_server):
    _delete_all(app_server)
    objects = _list_objects(app_server)
    assert objects == [], (
        f"Expected empty objects list before upload, got: {objects!r}"
    )


def test_upload_returns_expected_metadata(app_server):
    files = {"file": ("pixel.png", PNG_BYTES, "image/png")}
    resp = requests.post(f"{app_server}/api/files", files=files, timeout=60)
    assert resp.status_code == 201, (
        f"POST /api/files expected 201, got {resp.status_code}: {resp.text!r}"
    )
    body = resp.json()
    assert body.get("sha256") == EXPECTED_SHA256, (
        f"Response sha256 mismatch. Expected {EXPECTED_SHA256}, got {body.get('sha256')!r}."
    )
    assert body.get("key") == EXPECTED_KEY, (
        f"Response key mismatch. Expected {EXPECTED_KEY}, got {body.get('key')!r}."
    )
    assert body.get("size") == len(PNG_BYTES), (
        f"Response size mismatch. Expected {len(PNG_BYTES)}, got {body.get('size')!r}."
    )
    assert body.get("contentType") == "image/png", (
        f"Response contentType mismatch. Expected 'image/png', got {body.get('contentType')!r}."
    )


def test_upload_is_idempotent(app_server):
    files = {"file": ("pixel.png", PNG_BYTES, "image/png")}
    resp = requests.post(f"{app_server}/api/files", files=files, timeout=60)
    assert resp.status_code == 201, (
        f"Second POST /api/files expected 201, got {resp.status_code}: {resp.text!r}"
    )
    body = resp.json()
    assert body.get("key") == EXPECTED_KEY, (
        f"Second upload key changed. Expected {EXPECTED_KEY}, got {body.get('key')!r}."
    )
    assert body.get("sha256") == EXPECTED_SHA256, (
        f"Second upload sha256 changed. Expected {EXPECTED_SHA256}, got {body.get('sha256')!r}."
    )


def test_download_returns_exact_bytes_and_headers(app_server):
    url = f"{app_server}/api/files/{quote(EXPECTED_KEY, safe='')}"
    resp = requests.get(url, timeout=60)
    assert resp.status_code == 200, (
        f"GET /api/files/<key> expected 200, got {resp.status_code}: {resp.text!r}"
    )
    assert resp.content == PNG_BYTES, (
        "Downloaded body bytes do not match the uploaded PNG bytes."
    )
    content_type = resp.headers.get("Content-Type", "")
    assert "image/png" in content_type, (
        f"Content-Type response header should be 'image/png', got: {content_type!r}."
    )
    content_length = resp.headers.get("Content-Length")
    assert content_length == str(len(PNG_BYTES)), (
        f"Content-Length response header should be {len(PNG_BYTES)}, got: {content_length!r}."
    )


def test_list_after_upload(app_server):
    objects = _list_objects(app_server)
    matching = [o for o in objects if o.get("key") == EXPECTED_KEY]
    assert len(matching) == 1, (
        f"Expected exactly one object with key {EXPECTED_KEY} in listing, got: {objects!r}"
    )
    entry = matching[0]
    assert entry.get("size") == len(PNG_BYTES), (
        f"Listing entry size mismatch. Expected {len(PNG_BYTES)}, got {entry.get('size')!r}."
    )
    uploaded = entry.get("uploaded")
    assert isinstance(uploaded, str) and uploaded, (
        f"Listing entry 'uploaded' must be a non-empty ISO-8601 string, got: {uploaded!r}"
    )
    # Accept trailing 'Z' as a valid ISO-8601 UTC marker.
    try:
        datetime.fromisoformat(uploaded.replace("Z", "+00:00"))
    except ValueError as exc:
        raise AssertionError(
            f"Listing entry 'uploaded' is not a valid ISO-8601 string: {uploaded!r} ({exc})"
        )


def test_get_unknown_key_returns_404(app_server):
    url = f"{app_server}/api/files/{quote('uploads/does-not-exist.bin', safe='')}"
    resp = requests.get(url, timeout=30)
    assert resp.status_code == 404, (
        f"GET on unknown key expected 404, got {resp.status_code}: {resp.text!r}"
    )


def test_delete_existing_returns_204(app_server):
    url = f"{app_server}/api/files/{quote(EXPECTED_KEY, safe='')}"
    resp = requests.delete(url, timeout=30)
    assert resp.status_code == 204, (
        f"DELETE on existing key expected 204, got {resp.status_code}: {resp.text!r}"
    )
    assert resp.content in (b"", None), (
        f"DELETE 204 response should have an empty body, got: {resp.content!r}"
    )


def test_delete_missing_returns_404(app_server):
    url = f"{app_server}/api/files/{quote('uploads/also-missing.bin', safe='')}"
    resp = requests.delete(url, timeout=30)
    assert resp.status_code == 404, (
        f"DELETE on missing key expected 404, got {resp.status_code}: {resp.text!r}"
    )


def test_list_is_empty_after_delete(app_server):
    objects = _list_objects(app_server)
    assert objects == [], (
        f"Expected empty objects list after delete, got: {objects!r}"
    )


def test_post_without_file_field_returns_400(app_server):
    files = {"not_file": ("nope.txt", b"hello", "text/plain")}
    resp = requests.post(f"{app_server}/api/files", files=files, timeout=30)
    assert resp.status_code == 400, (
        f"POST without 'file' field expected 400, got {resp.status_code}: {resp.text!r}"
    )
