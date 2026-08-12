import json
import os
import shutil
import subprocess
import time
import urllib.error
import urllib.request

import pytest


PROJECT_DIR = "/home/user/myproject"
PB_URL = "http://127.0.0.1:8090"


# ---------------------------- helpers ----------------------------
# NOTE: PocketBase (superuser bootstrapped, server started, and the
# `messages` collection created) is fully provisioned by
# environment/entrypoint.sh before this test runs. Everything below only
# asserts that provisioning already happened — it must never create the
# data dir, bootstrap the superuser, start the server, or create the
# collection itself.

def _http_get(url: str, headers: dict | None = None, timeout: float = 5.0):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode("utf-8")


def _http_post_json(url: str, payload: dict, headers: dict | None = None, timeout: float = 10.0):
    body = json.dumps(payload).encode("utf-8")
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=body, headers=h, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


def _wait_for_health(timeout_sec: float = 30.0) -> bool:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            status, _ = _http_get(f"{PB_URL}/api/health", timeout=2.0)
            if status == 200:
                return True
        except Exception:
            pass
        time.sleep(0.3)
    return False


def _superuser_token() -> str:
    email = os.environ["PB_ADMIN_EMAIL"]
    password = os.environ["PB_ADMIN_PASSWORD"]
    status, body = _http_post_json(
        f"{PB_URL}/api/collections/_superusers/auth-with-password",
        {"identity": email, "password": password},
    )
    assert status == 200, f"Superuser auth failed: status={status} body={body}"
    return json.loads(body)["token"]


# ---------------------------- tests ----------------------------

def test_pocketbase_binary_available():
    assert shutil.which("pocketbase") is not None, (
        "pocketbase binary not found in PATH. The PocketBase v0.31.0 binary must be installed."
    )


def test_pocketbase_server_version():
    """Verify the installed PocketBase server is v0.31.0."""
    result = subprocess.run(
        ["pocketbase", "--version"],
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert result.returncode == 0, f"`pocketbase --version` failed: {result.stderr!r}"
    out = (result.stdout + result.stderr).strip()
    assert "0.31.0" in out, f"Expected PocketBase v0.31.0, got: {out!r}"


def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_admin_env_vars_present():
    assert os.environ.get("PB_ADMIN_EMAIL"), "PB_ADMIN_EMAIL env var must be set."
    assert os.environ.get("PB_ADMIN_PASSWORD"), "PB_ADMIN_PASSWORD env var must be set."


def test_pocketbase_server_is_running():
    assert _wait_for_health(15.0), (
        f"PocketBase server is not reachable at {PB_URL}/api/health"
    )


def test_messages_collection_exists():
    token = _superuser_token()
    status, body = _http_get(
        f"{PB_URL}/api/collections/messages",
        headers={"Authorization": token},
    )
    assert status == 200, f"messages collection lookup failed: status={status} body={body}"
    data = json.loads(body)
    field_names = {f.get("name") for f in data.get("fields", [])}
    assert "chat" in field_names, f"messages collection is missing 'chat' field. fields={field_names}"
    assert "body" in field_names, f"messages collection is missing 'body' field. fields={field_names}"


def test_subscribe_script_not_yet_created():
    # The agent is expected to create subscribe.js; it must not exist at initial state.
    path = os.path.join(PROJECT_DIR, "subscribe.js")
    assert not os.path.exists(path), (
        f"{path} must not exist at initial state; the agent is expected to create it."
    )
