import json
import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/godot_coroutine_scheduler"
SCHEDULER_FILE = os.path.join(PROJECT_DIR, "scheduler", "frame_scheduler.gd")
DRIVER_FILE = os.path.join(PROJECT_DIR, "verify_driver.gd")
TRANSCRIPT_FILE = os.path.join(PROJECT_DIR, "transcript.json")

EXPECTED_TRANSCRIPT = [
    "0|A|start",
    "0|B|start",
    "0|C|start",
    "0|D|start",
    "1|B|open_gate",
    "1|C|gate_opened",
    "1|C|complete",
    "2|A|resume",
    "3|B|pulse",
    "3|B|complete",
    "3|D|pulsed",
    "4|A|end",
    "4|A|complete",
    "4|D|end",
    "4|D|complete",
]

# Canonical grading harness. The verifier owns this file and rewrites it on every
# run so the solution cannot bypass the scheduler. It loads the scheduler by
# path (so it does not depend on the global class-name cache), reproduces the
# exact scenario from the task, and writes the recorded transcript to
# res://transcript.json.
DRIVER_SOURCE = '''extends SceneTree

class Bus extends RefCounted:
    signal pulse

var sched = load("res://scheduler/frame_scheduler.gd").new()
var events: Array = []
var gate := {"open": false}
var bus := Bus.new()

func _done(task_name):
    events.append("%d|%s|complete" % [sched.current_frame, task_name])

func task_a():
    events.append("%d|A|start" % sched.current_frame)
    await sched.wait_frames(2)
    events.append("%d|A|resume" % sched.current_frame)
    await sched.wait_frames(2)
    events.append("%d|A|end" % sched.current_frame)

func task_b():
    events.append("%d|B|start" % sched.current_frame)
    await sched.wait_frames(1)
    events.append("%d|B|open_gate" % sched.current_frame)
    gate.open = true
    await sched.wait_frames(2)
    events.append("%d|B|pulse" % sched.current_frame)
    bus.pulse.emit()

func task_c():
    events.append("%d|C|start" % sched.current_frame)
    await sched.wait_until(func(): return gate.open)
    events.append("%d|C|gate_opened" % sched.current_frame)

func task_d():
    events.append("%d|D|start" % sched.current_frame)
    await sched.wait_signal(bus.pulse)
    events.append("%d|D|pulsed" % sched.current_frame)
    await sched.wait_frames(1)
    events.append("%d|D|end" % sched.current_frame)

func _initialize():
    sched.spawn("A", task_a, _done)
    sched.spawn("B", task_b, _done)
    sched.spawn("C", task_c, _done)
    sched.spawn("D", task_d, _done)
    sched.advance(7)
    var f := FileAccess.open("res://transcript.json", FileAccess.WRITE)
    if f == null:
        push_error("VERIFY_DRIVER: cannot open transcript.json for writing")
        quit(2)
        return
    f.store_string(JSON.stringify(events))
    f.flush()
    f.close()
    quit(0)
'''


def _read_scheduler_source():
    with open(SCHEDULER_FILE) as fh:
        return fh.read()


def _run_harness():
    """Write the canonical driver, run it headless, return the parsed transcript."""
    if os.path.exists(TRANSCRIPT_FILE):
        os.remove(TRANSCRIPT_FILE)
    with open(DRIVER_FILE, "w") as fh:
        fh.write(DRIVER_SOURCE)

    result = subprocess.run(
        [
            "godot",
            "--headless",
            "--path",
            PROJECT_DIR,
            "--script",
            "res://verify_driver.gd",
        ],
        capture_output=True,
        text=True,
        timeout=180,
    )
    assert result.returncode == 0, (
        "Headless run of the scheduler harness failed "
        f"(exit {result.returncode}).\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )
    combined = (result.stdout or "") + (result.stderr or "")
    for marker in ("SCRIPT ERROR", "Parse Error", "SCRIPT ERROR:", "Cannot call method"):
        assert marker not in combined, (
            f"Godot reported a script error while running the harness:\n{combined}"
        )
    assert os.path.isfile(TRANSCRIPT_FILE), (
        f"Harness did not produce {TRANSCRIPT_FILE}.\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )
    with open(TRANSCRIPT_FILE) as fh:
        data = json.load(fh)
    return data


def test_scheduler_file_exists():
    assert os.path.isfile(SCHEDULER_FILE), (
        f"Expected the scheduler script at {SCHEDULER_FILE}."
    )


def test_scheduler_declares_class_name_and_base():
    src = _read_scheduler_source()
    assert re.search(r"(?m)^\s*class_name\s+FrameScheduler\b", src), (
        "frame_scheduler.gd must declare `class_name FrameScheduler`."
    )
    assert re.search(r"(?m)^\s*extends\s+RefCounted\b", src), (
        "frame_scheduler.gd must declare `extends RefCounted`."
    )


def test_scheduler_does_not_use_wallclock_or_network():
    """Secondary, non-runtime constraint: timing must be driven only by advance().

    The determinism of the transcript is the primary runtime proof; this guards
    against smuggling in real-time / engine-frame / network sources.
    """
    src = _read_scheduler_source()
    forbidden = [
        "get_ticks_msec",
        "get_ticks_usec",
        "create_timer",
        "SceneTreeTimer",
        "process_frame",
        "physics_frame",
        "Time.",
        "HTTPRequest",
        "HTTPClient",
        "StreamPeerTCP",
    ]
    hits = [tok for tok in forbidden if tok in src]
    assert not hits, (
        "Scheduler must not depend on wall-clock time, engine frames, or the "
        f"network; found forbidden references: {hits}"
    )


def test_transcript_matches_expected():
    transcript = _run_harness()
    assert isinstance(transcript, list), (
        f"Transcript must be a JSON array, got {type(transcript).__name__}."
    )
    assert transcript == EXPECTED_TRANSCRIPT, (
        "Execution transcript did not match the required deterministic "
        f"interleaving.\nExpected:\n{EXPECTED_TRANSCRIPT}\nGot:\n{transcript}"
    )


def test_transcript_is_deterministic_across_runs():
    runs = [_run_harness() for _ in range(3)]
    for i, run in enumerate(runs):
        assert run == EXPECTED_TRANSCRIPT, (
            f"Run {i + 1} did not match the expected transcript.\n"
            f"Expected:\n{EXPECTED_TRANSCRIPT}\nGot:\n{run}"
        )
