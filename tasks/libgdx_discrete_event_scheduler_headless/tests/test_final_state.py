import os
import subprocess

import pytest

PROJECT_DIR = "/home/user/project"
RUN_SH = os.path.join(PROJECT_DIR, "run.sh")
SCENARIO_DIR = os.path.join(PROJECT_DIR, "scenarios")
OUT_DIR = os.path.join(PROJECT_DIR, "out")

# Generous timeout: the first invocation may compile the project offline.
RUN_TIMEOUT = 900

S1_INPUT = """servers 1
discipline FIFO
A 0 3
B 1 2
C 2 1
"""

S1_EXPECTED = """TRANSCRIPT
t 0 ARRIVE A
t 0 START_SERVICE A server 0
t 1 ARRIVE B
t 2 ARRIVE C
t 3 DEPART A server 0
t 3 START_SERVICE B server 0
t 5 DEPART B server 0
t 5 START_SERVICE C server 0
t 6 DEPART C server 0
METRICS
job A wait 0 turnaround 3
job B wait 2 turnaround 4
job C wait 3 turnaround 4
STATS
mean_wait 1.667
max_queue 2
server 0 utilization 1.000"""

S2_INPUT = """servers 2
discipline SJF
j1 0 5
j2 0 2
j3 1 4
j4 1 1
"""

S2_EXPECTED = """TRANSCRIPT
t 0 ARRIVE j1
t 0 START_SERVICE j1 server 0
t 0 ARRIVE j2
t 0 START_SERVICE j2 server 1
t 1 ARRIVE j3
t 1 ARRIVE j4
t 2 DEPART j2 server 1
t 2 START_SERVICE j4 server 1
t 3 DEPART j4 server 1
t 3 START_SERVICE j3 server 1
t 5 DEPART j1 server 0
t 7 DEPART j3 server 1
METRICS
job j1 wait 0 turnaround 5
job j2 wait 0 turnaround 2
job j3 wait 2 turnaround 6
job j4 wait 1 turnaround 2
STATS
mean_wait 0.750
max_queue 2
server 0 utilization 0.714
server 1 utilization 1.000"""


def _normalize(text):
    """Strip trailing whitespace on each line and drop trailing blank lines."""
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return lines


def _write_scenario(name, content):
    os.makedirs(SCENARIO_DIR, exist_ok=True)
    path = os.path.join(SCENARIO_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return path


def _run_scenario(scenario_path, out_name):
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, out_name)
    if os.path.exists(out_path):
        os.remove(out_path)
    result = subprocess.run(
        ["bash", "run.sh", "--scenario", scenario_path, "--out", out_path],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=RUN_TIMEOUT,
    )
    assert result.returncode == 0, (
        f"'bash run.sh' failed (exit {result.returncode}).\n"
        f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )
    assert os.path.isfile(out_path), (
        f"Expected report file {out_path} was not created.\n"
        f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )
    with open(out_path, "r", encoding="utf-8") as f:
        return f.read(), out_path


def _iter_java_files():
    java_files = []
    for root, dirs, files in os.walk(PROJECT_DIR):
        # Skip build output / cache directories that may contain decompiled or
        # generated references unrelated to the solution source.
        dirs[:] = [
            d
            for d in dirs
            if d not in {"build", ".gradle", ".git", "bin", "out"}
        ]
        for name in files:
            if name.endswith(".java"):
                java_files.append(os.path.join(root, name))
    return java_files


def test_run_sh_exists():
    assert os.path.isfile(RUN_SH), f"Required entrypoint {RUN_SH} does not exist."


def test_uses_headless_application_and_binary_heap():
    java_files = _iter_java_files()
    assert java_files, f"No .java source files found under {PROJECT_DIR}."
    blob = ""
    for path in java_files:
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                blob += f.read() + "\n"
        except OSError:
            continue
    assert "HeadlessApplication" in blob, (
        "Solution source does not reference 'HeadlessApplication'; the simulation "
        "must run under the libGDX headless backend."
    )
    assert "BinaryHeap" in blob, (
        "Solution source does not reference 'BinaryHeap'; events must be scheduled "
        "using libGDX's com.badlogic.gdx.utils.BinaryHeap."
    )


def test_scenario1_fifo_single_server():
    path = _write_scenario("s1.txt", S1_INPUT)
    actual, _ = _run_scenario(path, "s1.out")
    assert _normalize(actual) == _normalize(S1_EXPECTED), (
        "Scenario 1 (FIFO, single server) report does not match expected output.\n"
        f"--- actual ---\n{actual}\n--- expected ---\n{S1_EXPECTED}"
    )


def test_scenario2_sjf_two_servers():
    path = _write_scenario("s2.txt", S2_INPUT)
    actual, _ = _run_scenario(path, "s2.out")
    assert _normalize(actual) == _normalize(S2_EXPECTED), (
        "Scenario 2 (SJF, two servers) report does not match expected output.\n"
        f"--- actual ---\n{actual}\n--- expected ---\n{S2_EXPECTED}"
    )


def test_scenario2_deterministic_rerun():
    path = _write_scenario("s2.txt", S2_INPUT)
    first, _ = _run_scenario(path, "s2_a.out")
    second, _ = _run_scenario(path, "s2_b.out")
    assert first == second, (
        "Report is not byte-for-byte deterministic across identical runs.\n"
        f"--- first ---\n{first}\n--- second ---\n{second}"
    )


def test_scenario2_ordering_and_discipline():
    path = _write_scenario("s2.txt", S2_INPUT)
    actual, _ = _run_scenario(path, "s2_ord.out")
    lines = _normalize(actual)
    # Transcript body sits between the TRANSCRIPT and METRICS markers.
    assert "TRANSCRIPT" in lines and "METRICS" in lines, (
        "Report is missing required TRANSCRIPT/METRICS section markers."
    )
    transcript = lines[lines.index("TRANSCRIPT") + 1 : lines.index("METRICS")]

    # Priority (DEPART<START_SERVICE<ARRIVE) + insertion-sequence tie-break at t=0.
    time0 = [ln for ln in transcript if ln.startswith("t 0 ")]
    assert time0 == [
        "t 0 ARRIVE j1",
        "t 0 START_SERVICE j1 server 0",
        "t 0 ARRIVE j2",
        "t 0 START_SERVICE j2 server 1",
    ], f"Unexpected event ordering at time 0: {time0}"

    # SJF must dispatch the shorter job (j4, duration 1) before j3 (duration 4)
    # when server 1 frees up at t=2.
    start_order = [
        ln.split()[3] for ln in transcript if ln.startswith("t ") and "START_SERVICE" in ln
    ]
    assert start_order.index("j4") < start_order.index("j3"), (
        f"SJF discipline violated: expected j4 to start service before j3, got order {start_order}"
    )
