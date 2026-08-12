import os
import shutil
import time
import urllib.request
import urllib.error
import json
import pytest

PROJECT_DIR = "/home/user/pb-task"

def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_project_dir_and_input_image_exist():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."
    input_jpg = os.path.join(PROJECT_DIR, "input.jpg")
    assert os.path.isfile(input_jpg), f"Input image {input_jpg} does not exist."

def _wait_for_health(timeout_sec=15):
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            resp = urllib.request.urlopen("http://127.0.0.1:8090/api/health", timeout=2)
            if resp.status == 200:
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def test_pocketbase_running_and_configured():
    # PocketBase (with the admin superuser and the `gallery` collection) is
    # provisioned by environment/entrypoint.sh before this test runs. This
    # test only asserts that provisioning already happened — it must never
    # start the server, create the superuser, or create the collection.
    assert shutil.which("pocketbase") is not None, "pocketbase binary not found in PATH."

    if not _wait_for_health():
        pytest.fail("PocketBase is not running at http://127.0.0.1:8090")

    # Authenticate to get token
    req = urllib.request.Request("http://127.0.0.1:8090/api/collections/_superusers/auth-with-password", data=json.dumps({
        "identity": "admin@example.com",
        "password": "adminpassword"
    }).encode("utf-8"), headers={"Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req)
        auth_data = json.loads(resp.read().decode("utf-8"))
        token = auth_data["token"]
    except Exception as e:
        pytest.fail(f"Failed to authenticate admin: {e}")

    # Check the gallery collection already exists (must NOT create it here).
    req = urllib.request.Request("http://127.0.0.1:8090/api/collections/gallery", headers={"Authorization": f"Bearer {token}"})
    try:
        urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        pytest.fail(f"Expected 'gallery' collection to already exist, got HTTP {e.code}.")
