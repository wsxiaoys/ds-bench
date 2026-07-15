import os
import re
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/taskboard"
MAIN_WASP = os.path.join(PROJECT_DIR, "main.wasp")

CLIENT_PORT = 3000
SERVER_PORT = 3001
# The web client must be visited on `localhost` so that the browser's origin
# matches Wasp's configured client URL (http://localhost:3000) and the API
# calls to the server (port 3001) are not blocked by CORS.
BASE_URL = f"http://localhost:{CLIENT_PORT}"


def _port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(2)
        return s.connect_ex((host, port)) == 0


# ---------------------------------------------------------------------------
# Static check: the derived stats query must be decoupled from the Task entity.
# ---------------------------------------------------------------------------

def _declaration_block(content: str, keyword: str, name: str):
    m = re.search(rf"\b{keyword}\s+{name}\b", content)
    if not m:
        return None
    rest = content[m.end():]
    nxt = re.search(r"\n\s*(?:app|route|page|query|action|api|job|crud|entity)\s+\w+", rest)
    end = m.end() + (nxt.start() if nxt else len(rest))
    return content[m.start():end]


def _entities_of(block: str):
    em = re.search(r"entities\s*:\s*\[([^\]]*)\]", block)
    if not em:
        return None
    return [name.strip() for name in em.group(1).split(",") if name.strip()]


def test_main_wasp_entity_decoupling():
    assert os.path.isfile(MAIN_WASP), f"{MAIN_WASP} does not exist."
    content = open(MAIN_WASP, encoding="utf-8").read()

    stats_block = _declaration_block(content, "query", "getProjectStats")
    assert stats_block is not None, "Could not find a `query getProjectStats` declaration in main.wasp."
    stats_entities = _entities_of(stats_block)
    assert stats_entities is not None, "The getProjectStats query must declare an `entities` list."
    assert "Project" in stats_entities, (
        f"getProjectStats must declare the Project entity; found entities: {stats_entities}."
    )
    assert "Task" not in stats_entities, (
        "getProjectStats must NOT list the Task entity (it must stay decoupled so it is refreshed "
        f"via manual React Query cache management); found entities: {stats_entities}."
    )

    tasks_block = _declaration_block(content, "query", "getTasks")
    assert tasks_block is not None, "Could not find a `query getTasks` declaration in main.wasp."
    tasks_entities = _entities_of(tasks_block)
    assert tasks_entities is not None and "Task" in tasks_entities, (
        f"getTasks must declare the Task entity for automatic invalidation; found entities: {tasks_entities}."
    )


# ---------------------------------------------------------------------------
# Runtime setup: seed the database to a known state and start the Wasp app.
# ---------------------------------------------------------------------------

def _run(cmd):
    print(f"$ {' '.join(cmd)} (cwd={PROJECT_DIR})")
    result = subprocess.run(
        cmd,
        cwd=PROJECT_DIR,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        timeout=900,
    )
    print(result.stdout)
    print(result.stderr)
    return result


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def start_app(xprocess):
    # Apply migrations and seed the database to the deterministic initial state
    # BEFORE launching the dev server.
    _run(["wasp", "db", "migrate-dev"])
    seed = _run(["wasp", "db", "seed", "devSeed"])
    assert seed.returncode == 0, (
        f"`wasp db seed devSeed` failed (returncode={seed.returncode}). "
        "The task requires a runnable seed named `devSeed`."
    )

    class Starter(ProcessStarter):
        name = "wasp_start"
        args = ["wasp", "start"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 700
        terminate_on_interrupt = True

        def startup_check(self):
            # The Vite web client (3000) and the API server (3001) must both be up.
            if not _port_open("127.0.0.1", CLIENT_PORT) and not _port_open("localhost", CLIENT_PORT):
                return False
            if not _port_open("127.0.0.1", SERVER_PORT) and not _port_open("localhost", SERVER_PORT):
                return False
            try:
                resp = requests.get(BASE_URL, timeout=20)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        try:
            with open(info.logpath, "r") as f:
                all_lines = f.readlines()
        except OSError:
            all_lines = []
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"===================== [{tag}: Begin] {Starter.name} logfile =====================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"===================== [{tag}: End  ] {Starter.name} logfile =====================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


# ---------------------------------------------------------------------------
# Browser verification of the reactive cache behavior.
# ---------------------------------------------------------------------------

def test_reactive_cache_invalidation(start_app, browser_verifier):
    reason = (
        "The task board must relate Actions to the Queries they affect. The plain task list "
        "(getTasks) is kept fresh by Wasp's automatic entity-based cache invalidation, while the "
        "derived per-project statistics query (getProjectStats) is intentionally decoupled from the "
        "Task entity and must be refreshed via manual React Query cache management. All UI values "
        "must update live after Actions, without a full page reload, and must persist to the database."
    )
    truth = (
        f"Navigate to {BASE_URL} and wait for the board to load. "
        "There are two projects. The 'Work' project shows a total task count of 2 and a done count of 1. "
        "The 'Home' project shows a total task count of 1 and a done count of 0. "
        "Three tasks are listed overall: 'Ship release', 'Write docs' and 'Buy groceries'. "
        "Step 1: Without reloading the page, click the control that adds a new task to the 'Work' project. "
        "After a moment (do NOT reload the page), verify that a new task appears in the task list AND that "
        "the 'Work' project's total task count has changed from 2 to 3 while its done count is still 1. "
        "Step 2: Without reloading the page, click the toggle control on the 'Write docs' task to mark it done. "
        "After a moment (do NOT reload the page), verify that the 'Work' project's done count changed from 1 to 2 "
        "and its total is still 3, and that 'Write docs' now appears as done. "
        "Step 3: Now reload the page and verify the 'Work' project still shows a total of 3 and a done count of 2, "
        "confirming the changes were persisted. "
        "The verification passes only if the counts update live (without a reload) in steps 1 and 2 and persist after the reload in step 3."
    )

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_reactive_cache_invalidation",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
