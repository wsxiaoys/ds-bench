import os
import shutil
import urllib.request
import urllib.error
import time

PROJECT_DIR = "/home/user/myproject"

def test_node_installed():
    assert shutil.which("node") is not None, "Node.js is not installed."
    assert shutil.which("npm") is not None, "npm is not installed."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"package.json does not exist at {package_json_path}."

def test_pocketbase_running():
    # PocketBase is started by environment/entrypoint.sh against the data
    # directory that was pre-seeded (with the test user) at image build
    # time. This test only asserts the server is already up — it must never
    # start it itself.
    url = "http://127.0.0.1:8090/api/health"
    max_retries = 15
    for i in range(max_retries):
        try:
            response = urllib.request.urlopen(url, timeout=2)
            if response.status == 200:
                return
        except urllib.error.URLError:
            pass
        time.sleep(1)
    assert False, "PocketBase is not running at http://127.0.0.1:8090"
