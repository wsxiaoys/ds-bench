import os
import subprocess
import json
import pytest
import socket
import portpicker
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/myproject"

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()

@pytest.fixture(scope="session")
def start_app(xprocess, app_port):
    """
    Starts the npm service using xprocess. Confirms readiness via port check.
    """

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "dev", "--", "--port", str(app_port)]
        # CRITICAL: set `env` as a class attribute here, NEVER inside `popen_kwargs`.
        # Otherwise, `Popen` raises `TypeError: got multiple values for keyword argument 'env'`.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        # Use startup_check to detect when startup is finished.
        def startup_check(self):
            """
            Custom check: returns True if the target port is accepting connections.
            xprocess calls this repeatedly until it returns True or times out.
            """
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

def test_convex_action_and_query():
    """
    Verify that the action can be called and the mutation saved the result.
    We create a temporary Node.js script to use the Convex client.
    """
    script_content = """
import { ConvexHttpClient } from "convex/browser";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.CONVEX_URL || process.env.VITE_CONVEX_URL);

async function main() {
    console.log("Calling action...");
    await client.action("ai:generate", { prompt: "Say hello world" });
    console.log("Action completed.");

    console.log("Querying list...");
    const results = await client.query("ai:list");
    console.log(JSON.stringify(results));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
"""
    script_path = os.path.join(PROJECT_DIR, "test_action.mjs")
    with open(script_path, "w") as f:
        f.write(script_content)

    # Need to make sure dotenv is installed in the project for the script to work
    subprocess.run(["npm", "install", "dotenv", "convex"], cwd=PROJECT_DIR, capture_output=True)

    result = subprocess.run(
        ["node", "test_action.mjs"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Node script failed: {result.stderr}"

    # Check the query results
    lines = result.stdout.strip().split("\n")
    # The last line should be the JSON array
    json_output = lines[-1]

    try:
        data = json.loads(json_output)
    except json.JSONDecodeError:
        pytest.fail(f"Failed to parse JSON from output: {json_output}")

    assert isinstance(data, list), "Expected a list of generations"

    found = False
    for item in data:
        if item.get("prompt") == "Say hello world" and item.get("result"):
            found = True
            break

    assert found, f"Expected to find a generation with prompt 'Say hello world' and a non-empty result. Got: {data}"

def test_ui(start_app, app_port, browser_verifier):
    """
    Verify the UI can trigger generation and display the result.
    """
    reason = "The application should have an input field to submit a prompt, trigger the AI generation, and display the result in a list."
    truth = f"Navigate to http://localhost:{app_port}. Verify that the page loads. Find the input field for the prompt, type 'What is the capital of France?', and click the submit button. Wait a few seconds for the AI generation to complete. Verify that 'What is the capital of France?' and the corresponding response (e.g. 'Paris') appear on the page."

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_convex_ui"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
