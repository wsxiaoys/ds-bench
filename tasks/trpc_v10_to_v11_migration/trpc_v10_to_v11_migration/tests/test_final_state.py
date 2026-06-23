import pytest
import subprocess
import time
import urllib.request
import urllib.error
import json
import os

PROJECT_DIR = "/home/user/project"

@pytest.fixture(scope="module", autouse=True)
def setup_server():
    # Start the dev server
    process = subprocess.Popen(["npm", "run", "dev"], cwd=PROJECT_DIR)
    
    # Wait for the server to be ready
    for _ in range(30):
        try:
            response = urllib.request.urlopen("http://localhost:3000")
            if response.getcode() == 200:
                break
        except urllib.error.URLError:
            pass
        time.sleep(1)
    else:
        process.kill()
        pytest.fail("Server did not start in time")
        
    yield
    
    # Teardown
    process.terminate()
    process.wait()

def test_home_page():
    process = subprocess.run(
        ["agent-browser", "evaluate", "http://localhost:3000", "document.body.innerText.includes('Hello tRPC v11')"],
        capture_output=True,
        text=True
    )
    assert "true" in process.stdout.lower() or "true" in process.stderr.lower(), "Page does not contain 'Hello tRPC v11'"

def test_api_call():
    req = urllib.request.Request(
        "http://localhost:3000/api/trpc/update?batch=1",
        data=json.dumps({"0": {"json": "world"}}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as response:
            assert response.getcode() == 200, f"Expected 200, got {response.getcode()}"
            data = json.loads(response.read().decode("utf-8"))
            assert "result" in data[0], "Response missing result"
            assert "data" in data[0]["result"], "Response missing data"
            assert data[0]["result"]["data"]["json"] == "Updated world", "Expected 'Updated world'"
    except urllib.error.HTTPError as e:
        pytest.fail(f"HTTP Error: {e.code} - {e.read().decode('utf-8')}")

def test_package_versions():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json_path, "r") as f:
        pkg = json.load(f)
    
    deps = pkg.get("dependencies", {})
    for p in ["@trpc/server", "@trpc/client", "@trpc/react-query", "@trpc/next"]:
        ver = deps.get(p, "")
        assert "11" in ver or "next" in ver, f"Expected {p} to be updated to v11 or next, got {ver}"
