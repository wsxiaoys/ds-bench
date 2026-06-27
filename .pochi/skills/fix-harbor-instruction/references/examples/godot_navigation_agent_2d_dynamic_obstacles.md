# Example: godot_navigation_agent_2d_dynamic_obstacles

## instruction.md diff (from PR #37)

```diff
diff --git a/tasks/godot_navigation_agent_2d_dynamic_obstacles/instruction.md b/tasks/godot_navigation_agent_2d_dynamic_obstacles/instruction.md
index b17849b418c..c3ee993f4ba 100644
--- a/tasks/godot_navigation_agent_2d_dynamic_obstacles/instruction.md
+++ b/tasks/godot_navigation_agent_2d_dynamic_obstacles/instruction.md
@@ -18,28 +18,4 @@ Build a Godot 4 navigation demo where a `CharacterBody2D` agent uses `Navigation
 - `NavigationAgent2D` exposes the `target_reached` signal; connect it once and store a boolean flag so the verifier can observe completion.
 - For obstacle outlines, store each obstacle's local `vertices` (a `PackedVector2Array`) and translate them by the obstacle's `global_position` before feeding them into the source geometry data.
 - Run the project with `godot --headless` for verification; do not rely on rendering.
-
-## Acceptance Criteria
-- Project path: `/home/user/godot_project`.
 - Command: `godot --headless --path /home/user/godot_project --script res://tests/run_tests.gd` (verifier-provided harness; do not modify it).
-- Scene `res://scenes/nav_world.tscn` exists with the following node tree (exact names and types):
-  - `NavWorld` (`Node2D`, script `res://scripts/nav_world.gd`, `class_name NavWorld`).
-    - `Region` (`NavigationRegion2D`, with an initial `NavigationPolygon`).
-    - `Obstacles` (`Node2D`) containing at least two children that are `NavigationObstacle2D` named `Obstacle1` and `Obstacle2`. Each obstacle's `vertices` property must define a non-empty closed polygon in local coordinates.
-    - `Agent` (`CharacterBody2D`, script `res://scripts/nav_agent.gd`, `class_name NavAgent`) at world position `(80, 300)`.
-      - `NavigationAgent2D` (`NavigationAgent2D`) as a child of `Agent`.
-    - `Goal` (`Marker2D`) at world position `(720, 300)`.
-- `res://scripts/nav_agent.gd` defines `class_name NavAgent` (extends `CharacterBody2D`) and:
-  - Exposes `movement_speed: float` (default `> 0`).
-  - Exposes a public boolean `reached` that starts `false` and becomes `true` after the agent's `NavigationAgent2D.target_reached` signal fires.
-  - Provides a method `set_destination(world_position: Vector2) -> void` that sets `NavigationAgent2D.target_position` to that world-space position.
-  - In `_physics_process`, while the navigation map is ready and the navigation is not finished, integrates velocity toward `get_next_path_position()` and calls `move_and_slide()` to physically advance the body.
-- `res://scripts/nav_world.gd` defines `class_name NavWorld` (extends `Node2D`) and:
-  - Provides `rebake_navigation() -> void` that rebuilds the `Region`'s `NavigationPolygon` from the walkable rectangle `(0, 0)`–`(800, 600)` carved by each `Obstacles/*` `NavigationObstacle2D` (translated to world space) using `NavigationServer2D.bake_from_source_geometry_data` and assigns the result back to `Region.navigation_polygon`.
-  - Provides `move_obstacle(obstacle_name: String, new_position: Vector2) -> void` that updates the named obstacle's `global_position` and then calls `rebake_navigation()`.
-  - Provides `start_navigation() -> void` that calls `Agent.set_destination(Goal.global_position)`.
-  - On `_ready`, performs an initial `rebake_navigation()` so the region is usable before any navigation queries.
-- Headless behavior:
-  - After instancing the scene and calling `start_navigation()`, the agent must converge on the goal under the initial obstacle layout (path must route around the obstacles) within the harness's time budget and set `reached = true`.
-  - After calling `move_obstacle("Obstacle1", far_offscreen)` and `move_obstacle("Obstacle2", far_offscreen)` and then `start_navigation()` again from a reset agent position, the agent must again reach the goal and set `reached = true`.
-
```

## tests/test_final_state.py (full)

```python
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
```
