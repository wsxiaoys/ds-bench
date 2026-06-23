import json
import os
import subprocess

PROJECT_DIR = "/home/user/godot_project"
RESULTS_PATH = os.path.join(PROJECT_DIR, "test_results.json")
HARNESS = "res://tests/run_tests.gd"


def _run_harness():
    if os.path.exists(RESULTS_PATH):
        os.remove(RESULTS_PATH)
    result = subprocess.run(
        [
            "godot",
            "--headless",
            "--path",
            PROJECT_DIR,
            "--script",
            HARNESS,
        ],
        capture_output=True,
        text=True,
        timeout=300,
        cwd=PROJECT_DIR,
    )
    return result


def _load_results():
    assert os.path.isfile(RESULTS_PATH), (
        f"Test results file {RESULTS_PATH} was not produced by the harness."
    )
    with open(RESULTS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def test_nav_world_script_exists():
    path = os.path.join(PROJECT_DIR, "scripts", "nav_world.gd")
    assert os.path.isfile(path), (
        f"Expected NavWorld script at {path}, not found."
    )


def test_nav_agent_script_exists():
    path = os.path.join(PROJECT_DIR, "scripts", "nav_agent.gd")
    assert os.path.isfile(path), (
        f"Expected NavAgent script at {path}, not found."
    )


def test_nav_world_scene_exists():
    path = os.path.join(PROJECT_DIR, "scenes", "nav_world.tscn")
    assert os.path.isfile(path), (
        f"Expected nav_world scene at {path}, not found."
    )


def test_headless_harness_executes_successfully():
    result = _run_harness()
    assert result.returncode == 0, (
        "Headless test harness exited with non-zero status.\n"
        f"stdout:\n{result.stdout}\n\nstderr:\n{result.stderr}"
    )
    results = _load_results()
    assert isinstance(results, dict), (
        f"Expected harness JSON output to be an object, got: {type(results).__name__}"
    )
    assert "assertions" in results, (
        f"Harness output missing 'assertions' key: {results!r}"
    )


def test_scene_structure_valid():
    results = _load_results()
    a = results["assertions"].get("scene_structure_valid")
    assert a is not None, "Missing assertion: scene_structure_valid"
    assert a.get("passed") is True, (
        f"nav_world.tscn must contain NavWorld root with Region (NavigationRegion2D), "
        f"Agent (CharacterBody2D, class_name NavAgent), Agent/NavigationAgent2D, "
        f"Obstacles/Obstacle1 and Obstacles/Obstacle2 (NavigationObstacle2D with non-empty vertices), "
        f"and Goal (Marker2D at (720, 300)). Got: {a}"
    )


def test_nav_agent_api_present():
    results = _load_results()
    a = results["assertions"].get("nav_agent_api_present")
    assert a is not None, "Missing assertion: nav_agent_api_present"
    assert a.get("passed") is True, (
        f"NavAgent must expose `reached`, `movement_speed`, and `set_destination(Vector2)`. Got: {a}"
    )


def test_nav_world_api_present():
    results = _load_results()
    a = results["assertions"].get("nav_world_api_present")
    assert a is not None, "Missing assertion: nav_world_api_present"
    assert a.get("passed") is True, (
        f"NavWorld must expose `rebake_navigation()`, `move_obstacle(String, Vector2)`, "
        f"and `start_navigation()`. Got: {a}"
    )


def test_agent_reaches_goal_with_obstacles():
    results = _load_results()
    a = results["assertions"].get("agent_reaches_goal_with_obstacles")
    assert a is not None, "Missing assertion: agent_reaches_goal_with_obstacles"
    assert a.get("passed") is True, (
        f"With default obstacles blocking the straight line, the agent must navigate "
        f"around them and fire `target_reached`, ending within 40 px of the goal. Got: {a}"
    )


def test_agent_reaches_goal_after_obstacles_moved():
    results = _load_results()
    a = results["assertions"].get("agent_reaches_goal_after_obstacles_moved")
    assert a is not None, "Missing assertion: agent_reaches_goal_after_obstacles_moved"
    assert a.get("passed") is True, (
        f"After move_obstacle(...) clears the corridor and rebake, the reset agent must "
        f"reach the goal again and fire `target_reached`. Got: {a}"
    )
