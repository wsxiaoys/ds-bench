import os
import socket
import json
import pytest
import portpicker
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/tanstack-query-products"

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()

@pytest.fixture(scope="session")
def start_app(xprocess, app_port):
    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "dev", "--", "--port", str(app_port)]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", app_port)) == 0

    info = xprocess.getinfo(Starter.name)

    def capture_logs(tag):
        with open(info.logpath, "r") as f:
            logs = f.read()
            print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
            print(logs)
            print(f"============================== [{tag}: End  ] Captured {Starter.name} logfile ==============================")

    started = False
    try:
        # ensure() starts the process and blocks until startup_check is True
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()

def test_browser_verification(start_app, app_port, browser_verifier):
    reason = "The application should fetch and display a list of products."
    truth = f"Navigate to http://localhost:{app_port}. Wait for the data to load. Verify that the page contains the text 'Laptop - $999'. Verify that the page contains the text 'Phone - $599'."
    
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
