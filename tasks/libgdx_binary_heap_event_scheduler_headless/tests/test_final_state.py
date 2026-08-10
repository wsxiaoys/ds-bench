import os
import re
import subprocess
from collections import deque

import pytest

PROJECT_DIR = "/home/user/libgdx-des"
FIXTURE_DIR = "/tmp/des_fixtures"
GRADLE_TIMEOUT = 900


# ---------------------------------------------------------------------------
# Independent reference simulator (oracle). Implements exactly the semantics
# specified in the task description. Expected outputs are DERIVED from the
# fixture inputs by this oracle, not hard-coded magic numbers.
# ---------------------------------------------------------------------------
def simulate(text):
    capacity = None
    service = None
    end = None
    initial = []  # list of (time, jobid) in file order

    for raw in text.split("\n"):
        line = raw.strip()
        if not line or line[0] == "#":
            continue
        toks = line.split()
        key = toks[0]
        if key == "CAPACITY":
            capacity = int(toks[1])
        elif key == "SERVICE":
            service = float(toks[1])
        elif key == "END":
            end = float(toks[1])
        else:
            # event line: <time> ARRIVE <jobid>
            initial.append((float(toks[0]), toks[2]))

    assert capacity is not None and service is not None and end is not None, (
        "reference fixture is missing a required directive"
    )

    import heapq

    heap = []
    seq = 0
    for (t, jid) in initial:
        heapq.heappush(heap, (t, seq, "ARRIVE", jid))
        seq += 1

    busy = 0
    queue = deque()
    arrival = {}
    completed = 0
    max_queue = 0
    waits = []
    log = []

    while heap:
        t, s, typ, jid = heapq.heappop(heap)
        if end >= 0 and t > end:
            break
        log.append(f"{t:.3f} {typ} {jid}")
        if typ == "ARRIVE":
            arrival[jid] = t
            queue.append(jid)
        else:
            busy -= 1
            completed += 1
        # dispatch
        while busy < capacity and queue:
            h = queue.popleft()
            waits.append(t - arrival[h])
            busy += 1
            heapq.heappush(heap, (t + service, seq, "DEPART", h))
            seq += 1
        if len(queue) > max_queue:
            max_queue = len(queue)

    avg = (sum(waits) / len(waits)) if waits else 0.0
    log.append(f"STATS completed={completed} max_queue={max_queue} avg_wait={avg:.3f}")
    return "\n".join(log) + "\n"


FIXTURES = {
    "contention.txt": (
        "CAPACITY 1\n"
        "SERVICE 2.0\n"
        "END -1\n"
        "0.0 ARRIVE a\n"
        "0.0 ARRIVE b\n"
        "1.0 ARRIVE c\n"
        "5.0 ARRIVE d\n"
        "5.0 ARRIVE e\n"
    ),
    "cutoff.txt": (
        "CAPACITY 2\n"
        "SERVICE 3.0\n"
        "END 4.0\n"
        "0.0 ARRIVE p\n"
        "0.0 ARRIVE q\n"
        "0.0 ARRIVE r\n"
        "2.0 ARRIVE s\n"
    ),
    "boundary.txt": (
        "CAPACITY 1\n"
        "SERVICE 2.5\n"
        "END 5.0\n"
        "0.0 ARRIVE x\n"
        "0.0 ARRIVE y\n"
    ),
    "comments.txt": (
        "# scenario with comments and reordered directives\n"
        "0.0 ARRIVE a\n"
        "\n"
        "SERVICE 2.0\n"
        "0.0 ARRIVE b\n"
        "CAPACITY 1\n"
        "# trailing comment\n"
        "END -1\n"
    ),
}

# Golden outputs documented in task.json's truth. Used to self-check the oracle
# so a bug in either the spec or the oracle is caught before grading agents.
GOLDEN = {
    "contention.txt": (
        "0.000 ARRIVE a\n"
        "0.000 ARRIVE b\n"
        "1.000 ARRIVE c\n"
        "2.000 DEPART a\n"
        "4.000 DEPART b\n"
        "5.000 ARRIVE d\n"
        "5.000 ARRIVE e\n"
        "6.000 DEPART c\n"
        "8.000 DEPART d\n"
        "10.000 DEPART e\n"
        "STATS completed=5 max_queue=2 avg_wait=1.800\n"
    ),
    "cutoff.txt": (
        "0.000 ARRIVE p\n"
        "0.000 ARRIVE q\n"
        "0.000 ARRIVE r\n"
        "2.000 ARRIVE s\n"
        "3.000 DEPART p\n"
        "3.000 DEPART q\n"
        "STATS completed=2 max_queue=2 avg_wait=1.000\n"
    ),
    "boundary.txt": (
        "0.000 ARRIVE x\n"
        "0.000 ARRIVE y\n"
        "2.500 DEPART x\n"
        "5.000 DEPART y\n"
        "STATS completed=2 max_queue=1 avg_wait=1.250\n"
    ),
    "comments.txt": (
        "0.000 ARRIVE a\n"
        "0.000 ARRIVE b\n"
        "2.000 DEPART a\n"
        "4.000 DEPART b\n"
        "STATS completed=2 max_queue=1 avg_wait=1.000\n"
    ),
}


def _normalize(text):
    """Split into non-empty logical lines, ignoring trailing whitespace/newlines."""
    return [ln.rstrip("\r") for ln in text.rstrip("\n").split("\n")]


@pytest.mark.parametrize("name", sorted(GOLDEN.keys()))
def test_oracle_matches_documented_golden(name):
    """Guard: the reference oracle must reproduce the golden outputs in truth."""
    assert _normalize(simulate(FIXTURES[name])) == _normalize(GOLDEN[name]), (
        f"Reference oracle disagrees with documented golden output for {name}."
    )


def _iter_source_text():
    skip = {"build", ".gradle", ".git", "caches", "wrapper"}
    for root, dirs, files in os.walk(PROJECT_DIR):
        dirs[:] = [d for d in dirs if d not in skip]
        for fn in files:
            if fn.endswith((".java", ".kt", ".gradle", ".kts")) or fn == "gradle.properties":
                try:
                    with open(os.path.join(root, fn), "r", encoding="utf-8", errors="ignore") as f:
                        yield os.path.join(root, fn), f.read()
                except OSError:
                    continue


def test_project_directory_and_wrapper_exist():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."
    assert os.path.isfile(os.path.join(PROJECT_DIR, "gradlew")), (
        f"Gradle wrapper {PROJECT_DIR}/gradlew not found."
    )


def test_uses_headless_backend_dependency():
    """Non-runtime constraint: the build must depend on the libGDX headless backend."""
    blob = "\n".join(text for _, text in _iter_source_text())
    assert "gdx-backend-headless" in blob, (
        "Project must depend on com.badlogicgames.gdx:gdx-backend-headless."
    )
    assert "HeadlessApplication" in blob, (
        "Project must boot through a libGDX HeadlessApplication."
    )


def test_uses_binaryheap_with_node_subclass():
    """Non-runtime constraint: the scheduler must be libGDX BinaryHeap with a Node subclass."""
    blob = "\n".join(text for _, text in _iter_source_text())
    assert "BinaryHeap" in blob, (
        "Project must use com.badlogic.gdx.utils.BinaryHeap as the event scheduler."
    )
    assert re.search(r"extends\s+(?:BinaryHeap\s*\.\s*)?Node\b", blob) or \
        re.search(r"extends\s+\w*\bBinaryHeap\s*\.\s*Node\b", blob), (
        "Project must define a custom subclass of BinaryHeap.Node for events."
    )


def _run_scenario(name, text):
    os.makedirs(FIXTURE_DIR, exist_ok=True)
    input_path = os.path.join(FIXTURE_DIR, name)
    output_path = os.path.join(FIXTURE_DIR, name.replace(".txt", ".out"))
    with open(input_path, "w", encoding="utf-8") as f:
        f.write(text)
    if os.path.exists(output_path):
        os.remove(output_path)

    result = subprocess.run(
        [
            "./gradlew",
            "--no-daemon",
            "--offline",
            "--console=plain",
            ":headless:run",
            f"--args=--input={input_path} --output={output_path}",
        ],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=GRADLE_TIMEOUT,
    )
    print(f"--- gradle stdout ({name}) ---\n{result.stdout}")
    print(f"--- gradle stderr ({name}) ---\n{result.stderr}")
    assert result.returncode == 0, (
        f"Gradle run failed for {name} (exit {result.returncode}). See captured logs above."
    )
    assert os.path.isfile(output_path), (
        f"Program did not create the output file {output_path} for {name}."
    )
    with open(output_path, "r", encoding="utf-8") as f:
        return f.read()


@pytest.mark.parametrize("name", sorted(FIXTURES.keys()))
def test_simulation_output_matches_expected(name):
    expected = simulate(FIXTURES[name])
    actual = _run_scenario(name, FIXTURES[name])
    assert _normalize(actual) == _normalize(expected), (
        f"Output mismatch for {name}.\nExpected:\n{expected}\nActual:\n{actual}"
    )
