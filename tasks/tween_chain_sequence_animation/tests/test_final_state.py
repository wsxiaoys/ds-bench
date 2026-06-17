import json
import math
import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/godot_project"
HARNESS_SRC = os.path.join(os.path.dirname(__file__), "harness", "run_harness.gd")
HARNESS_DST_DIR = os.path.join(PROJECT_DIR, "tests", "_harness")
HARNESS_DST = os.path.join(HARNESS_DST_DIR, "run_harness.gd")
OUTPUT_FILE = os.path.join(PROJECT_DIR, "harness_output.json")

_cached_results = None


def _install_harness():
    os.makedirs(HARNESS_DST_DIR, exist_ok=True)
    shutil.copyfile(HARNESS_SRC, HARNESS_DST)
    if os.path.exists(OUTPUT_FILE):
        os.remove(OUTPUT_FILE)


def _run_godot(args, timeout=180):
    return subprocess.run(
        ["godot", "--headless", "--path", PROJECT_DIR, *args],
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def _run_harness():
    global _cached_results
    if _cached_results is not None:
        return _cached_results
    _install_harness()
    _run_godot(["--import"], timeout=180)
    result = _run_godot(
        ["--script", "res://tests/_harness/run_harness.gd"], timeout=180
    )
    assert os.path.isfile(OUTPUT_FILE), (
        f"Harness did not produce {OUTPUT_FILE}. "
        f"returncode={result.returncode}, "
        f"stdout={result.stdout[-2000:]!r}, stderr={result.stderr[-2000:]!r}"
    )
    with open(OUTPUT_FILE) as f:
        data = json.load(f)
    assert "results" in data, f"Harness output missing 'results' key: {data}"
    _cached_results = data["results"]
    return _cached_results


def _approx(a, b, tol):
    return abs(a - b) <= tol


def _approx_vec(actual, expected, tol):
    return len(actual) == len(expected) and all(
        _approx(actual[i], expected[i], tol) for i in range(len(expected))
    )


def test_scene_and_nodes_exist():
    r = _run_harness()
    assert r.get("scene_loaded"), "Expected res://scenes/Animator.tscn to load."
    assert r.get("scene_instantiated"), "Expected Animator scene to instantiate."
    assert r.get("root_is_node2d"), "Animator scene root must be a Node2D."
    assert r.get("target_found"), "Expected child node named 'Target' to exist."
    assert r.get("controller_found"), (
        "Expected child node named 'TweenController' to exist."
    )
    assert r.get("target_classname") == "Node2D", (
        f"'Target' must be a Node2D, got {r.get('target_classname')!r}."
    )


def test_required_signals_declared():
    r = _run_harness()
    assert r.get("all_signals_declared"), (
        "TweenController must declare signals 'step_a_complete', 'step_b_complete', "
        f"'step_c_complete', and 'animation_complete'. detail={r.get('signals_declared')}"
    )


def test_initial_target_state():
    r = _run_harness()
    assert _approx_vec(r.get("initial_position", []), [0.0, 0.0], 1e-3), (
        f"Target.position must start at (0,0). got={r.get('initial_position')!r}"
    )
    assert _approx(r.get("initial_rotation", 1.0), 0.0, 1e-3), (
        f"Target.rotation must start at 0.0. got={r.get('initial_rotation')!r}"
    )
    assert _approx_vec(r.get("initial_scale", []), [1.0, 1.0], 1e-3), (
        f"Target.scale must start at (1,1). got={r.get('initial_scale')!r}"
    )
    assert _approx_vec(r.get("initial_modulate", []), [1.0, 1.0, 1.0, 1.0], 1e-3), (
        f"Target.modulate must start at (1,1,1,1). got={r.get('initial_modulate')!r}"
    )


def test_play_sequence_returns_tween():
    r = _run_harness()
    assert r.get("has_play_sequence"), "TweenController must expose play_sequence()."
    assert r.get("tween_returned"), (
        "play_sequence() must return a Tween instance running the animation."
    )


def test_checkpoint_t_0_50_linear_position():
    r = _run_harness()
    sample = r.get("samples", {}).get("t_0_50")
    assert sample is not None, "Missing checkpoint sample at t=0.50s."
    assert _approx_vec(sample["position"], [100.0, 50.0], 0.5), (
        "At t=0.50s the position must be ~(100, 50) (verifies step 1 uses TRANS_LINEAR). "
        f"got={sample['position']!r}"
    )


def test_checkpoint_t_1_00_step_a_complete():
    r = _run_harness()
    sample = r.get("samples", {}).get("t_1_00")
    assert sample is not None, "Missing checkpoint sample at t=1.00s."
    assert _approx_vec(sample["position"], [200.0, 100.0], 0.5), (
        f"At t=1.00s the position must be ~(200, 100). got={sample['position']!r}"
    )
    assert sample["signal_counts"]["step_a_complete"] == 1, (
        "step_a_complete must have been emitted exactly once by t=1.00s. "
        f"counts={sample['signal_counts']!r}"
    )


def test_checkpoint_t_1_50_parallel_progress():
    r = _run_harness()
    sample = r.get("samples", {}).get("t_1_50")
    assert sample is not None, "Missing checkpoint sample at t=1.50s."
    assert _approx_vec(sample["scale"], [1.5, 1.5], 0.05), (
        "At t=1.50s the scale must be ~(1.5,1.5) (verifies step 2 parallel + linear). "
        f"got={sample['scale']!r}"
    )
    modulate = sample["modulate"]
    assert _approx(modulate[3], 0.75, 0.05), (
        "At t=1.50s the modulate.a must be ~0.75 (verifies parallel modulate:a tween). "
        f"got={modulate!r}"
    )


def test_checkpoint_t_2_00_step_b_complete():
    r = _run_harness()
    sample = r.get("samples", {}).get("t_2_00")
    assert sample is not None, "Missing checkpoint sample at t=2.00s."
    assert _approx_vec(sample["scale"], [2.0, 2.0], 0.02), (
        f"At t=2.00s the scale must be (2,2). got={sample['scale']!r}"
    )
    modulate = sample["modulate"]
    assert _approx(modulate[3], 0.5, 0.02), (
        f"At t=2.00s the modulate.a must be 0.5. got={modulate!r}"
    )
    assert sample["signal_counts"]["step_b_complete"] == 1, (
        "step_b_complete must have been emitted exactly once by t=2.00s. "
        f"counts={sample['signal_counts']!r}"
    )


def test_checkpoint_t_3_00_step_c_complete():
    r = _run_harness()
    sample = r.get("samples", {}).get("t_3_00")
    assert sample is not None, "Missing checkpoint sample at t=3.00s."
    assert _approx(sample["rotation"], math.pi / 2, 0.005), (
        f"At t=3.00s rotation must be PI/2. got={sample['rotation']!r}"
    )
    assert sample["signal_counts"]["step_c_complete"] == 1, (
        "step_c_complete must have been emitted exactly once by t=3.00s. "
        f"counts={sample['signal_counts']!r}"
    )


def test_checkpoint_t_3_50_final_state():
    r = _run_harness()
    sample = r.get("samples", {}).get("t_3_50")
    assert sample is not None, "Missing checkpoint sample at t=3.50s."
    assert _approx_vec(sample["position"], [200.0, 100.0], 0.5), (
        f"At t=3.50s position must remain (200,100). got={sample['position']!r}"
    )
    assert _approx_vec(sample["scale"], [2.0, 2.0], 0.02), (
        f"At t=3.50s scale must remain (2,2). got={sample['scale']!r}"
    )
    assert _approx(sample["rotation"], math.pi / 2, 0.01), (
        f"At t=3.50s rotation must remain PI/2. got={sample['rotation']!r}"
    )
    modulate = sample["modulate"]
    assert _approx(modulate[0], 0.5, 0.02), (
        f"At t=3.50s modulate.r must be 0.5. got={modulate!r}"
    )
    assert _approx(modulate[3], 1.0, 0.02), (
        f"At t=3.50s modulate.a must be 1.0. got={modulate!r}"
    )
    assert sample["signal_counts"]["animation_complete"] == 1, (
        "animation_complete must have been emitted exactly once by t=3.50s. "
        f"counts={sample['signal_counts']!r}"
    )


def test_all_signals_emitted_exactly_once():
    r = _run_harness()
    counts = r.get("signal_counts", {})
    for s in ("step_a_complete", "step_b_complete", "step_c_complete", "animation_complete"):
        assert counts.get(s) == 1, (
            f"Signal {s!r} must be emitted exactly once. got={counts!r}"
        )


def test_is_running_false_after_completion():
    r = _run_harness()
    assert r.get("is_running_after_complete") is False, (
        "TweenController.is_running() must return False after the sequence completes. "
        f"got={r.get('is_running_after_complete')!r}"
    )
