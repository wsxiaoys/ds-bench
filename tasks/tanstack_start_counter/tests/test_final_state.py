import os
import socket
import pytest
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"

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
                return s.connect_ex(("localhost", 8234)) == 0

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0  # track how many lines have already been printed

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
        # ensure() starts the process and blocks until startup_check is True
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield
    capture_logs("TEARDOWN")
    info.terminate()

def test_counter_app(start_app, browser_verifier):
    reason = "The application should be a counter app running on port 8234 that displays the current count and has an increment button."
    truth = "Navigate to http://localhost:8234/. Verify that the page contains the text 'Count: 0'. Click the button with the text 'Increment'. Verify that the page updates to display 'Count: 1'. Click the 'Increment' button again. Verify that the page updates to display 'Count: 2'."
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_counter_app"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
