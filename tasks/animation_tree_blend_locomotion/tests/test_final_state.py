import json
import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/godot_project"
HARNESS_SRC = os.path.join(os.path.dirname(__file__), "harness", "run_harness.gd")
HARNESS_DST_DIR = os.path.join(PROJECT_DIR, "tests", "_harness")
HARNESS_DST = os.path.join(HARNESS_DST_DIR, "run_harness.gd")
OUTPUT_FILE = os.path.join(PROJECT_DIR, "harness_output.json")


def _install_harness():
    os.makedirs(HARNESS_DST_DIR, exist_ok=True)
    shutil.copyfile(HARNESS_SRC, HARNESS_DST)
    # Remove any stale output before running.
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
    _install_harness()
    # Trigger import so any new resources resolve.
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
    return data


def test_scene_and_nodes_exist():
    data = _run_harness()
    r = data["results"]
    assert r.get("scene_loaded"), "Expected res://scenes/Player.tscn to load."
    assert r.get("scene_instantiated"), "Expected the scene to instantiate."
    assert r.get("found_animation_player"), (
        "Expected to find a child node named 'AnimationPlayer' in the scene."
    )
    assert r.get("found_animation_tree"), (
        "Expected to find a child node named 'AnimationTree' in the scene."
    )
    assert r.get("found_controller"), (
        "Expected to find a child node named 'PlayerAnimController' in the scene."
    )


def test_required_animations_present():
    data = _run_harness()
    anims = data["results"].get("animations") or {}
    assert anims.get("ok"), (
        "AnimationPlayer is missing one or more required animations "
        f"(idle, walk_north, walk_south, walk_east, walk_west, attack). detail={anims.get('detail')}"
    )


def test_state_machine_structure():
    data = _run_harness()
    r = data["results"]
    assert r.get("tree_root_is_state_machine"), (
        "AnimationTree.tree_root must be an AnimationNodeStateMachine."
    )
    assert r.get("state_machine_has_locomotion"), (
        "State machine must contain a node named 'Locomotion'."
    )
    assert r.get("state_machine_has_attack"), (
        "State machine must contain a node named 'Attack'."
    )
    assert r.get("locomotion_is_blend_space_2d"), (
        "Locomotion must be an AnimationNodeBlendSpace2D."
    )
    assert r.get("blend_point_count_ok"), (
        "BlendSpace2D must contain at least 5 blend points "
        f"(got {r.get('blend_point_count')})."
    )
    assert r.get("attack_is_animation_node"), (
        "Attack state must be an AnimationNodeAnimation."
    )
    assert r.get("attack_animation_name_ok"), (
        "Attack AnimationNodeAnimation.animation must be 'attack' "
        f"(got {r.get('attack_animation_name')!r})."
    )


def test_runtime_controller_behavior():
    data = _run_harness()
    r = data["results"]
    assert r.get("tree_active"), "AnimationTree.active must become true."
    assert r.get("blend_position_ok"), (
        "After set_move_input(Vector2(1, 0)), parameters/Locomotion/blend_position "
        "must equal (1, 0) within 0.01. Raw value: "
        f"{r.get('blend_position_raw')!r}."
    )
    assert r.get("transitioned_to_attack"), (
        "After trigger_attack(), current_state() must return &\"Attack\" within a few frames."
    )
