import os
import socket
import json
import pytest
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/tanstack-query-products"
PORT = 4782

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "dev"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", PORT)) == 0

    xprocess.ensure(Starter.name, Starter)
    yield
    info = xprocess.getinfo(Starter.name)
    info.terminate()

def test_browser_verification(start_app, browser_verifier):
    reason = "The application should fetch and display a list of products."
    truth = f"Navigate to http://localhost:{PORT}. Wait for the data to load. Verify that the page contains the text 'Laptop - $999'. Verify that the page contains the text 'Phone - $599'."
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_verification"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_package_json_dependencies():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), "package.json not found."
    
    with open(package_json_path, "r") as f:
        data = json.load(f)
        
    deps = data.get("dependencies", {})
    dev_deps = data.get("devDependencies", {})
    
    assert "@tanstack/react-query" in deps or "@tanstack/react-query" in dev_deps, \
        "@tanstack/react-query is not installed in package.json"

def test_codebase_usage():
    # Check if useQuery and QueryClientProvider are imported/used in the codebase
    src_dir = os.path.join(PROJECT_DIR, "src")
    assert os.path.isdir(src_dir), "src directory not found."
    
    found_use_query = False
    found_provider = False
    
    for root, _, files in os.walk(src_dir):
        for file in files:
            if file.endswith((".ts", ".tsx", ".js", ".jsx")):
                file_path = os.path.join(root, file)
                with open(file_path, "r") as f:
                    content = f.read()
                    if "useQuery" in content:
                        found_use_query = True
                    if "QueryClientProvider" in content:
                        found_provider = True
                        
    assert found_use_query, "useQuery is not used in the source code."
    assert found_provider, "QueryClientProvider is not used in the source code."
