# Godot 4 — NavigationAgent2D With Dynamic NavigationObstacle2D Carving

## Background
Build a Godot 4 navigation demo where a `CharacterBody2D` agent uses `NavigationAgent2D` to reach a goal across a `NavigationRegion2D`-baked walkable area. The walkable mesh must be carved by `NavigationObstacle2D` nodes whose positions can change at runtime, requiring the navigation polygon to be re-baked so a new path can be found and the agent eventually fires `target_reached` at the goal.

## Requirements
- Build a runnable Godot 4 project that combines `NavigationRegion2D` baking, `NavigationAgent2D` path following, dynamic `NavigationObstacle2D` carving, and the `target_reached` signal.
- Define a packed scene `res://scenes/nav_world.tscn` that wires together the region, agent, obstacles, and goal marker described in the Acceptance Criteria.
- Provide a `NavWorld` controller node that can re-bake the navigation polygon (after obstacle moves) and start the navigation toward the goal.
- Provide a `NavAgent` `CharacterBody2D` script that drives the agent toward `NavigationAgent2D.get_next_path_position()` each physics tick and exposes a `reached` flag that flips to `true` exactly when `target_reached` fires.
- Movement must use the real `NavigationServer2D` map (not teleporting): each physics tick the agent reads the next path position from the navigation agent and integrates velocity with `move_and_slide()`.
- The agent must reach the goal both when obstacles block the straight line (forcing the path around) and after `NavWorld.move_obstacle(...)` clears the corridor and re-bakes.

## Implementation Hints
- Use `NavigationMeshSourceGeometryData2D` together with `NavigationServer2D.bake_from_source_geometry_data` to (re)build the `NavigationPolygon` so that obstacle outlines are carved out of the walkable rectangle.
- The walkable area is the rectangle from `(0, 0)` to `(800, 600)`. Add the walkable outline as a traversable outline and each obstacle's world-space outline as an obstruction outline.
- Wait for `NavigationServer2D.map_get_iteration_id(...)` to become non-zero (and skip queries before that) before driving the agent, otherwise `get_next_path_position()` returns stale data.
- `NavigationAgent2D` exposes the `target_reached` signal; connect it once and store a boolean flag so the verifier can observe completion.
- For obstacle outlines, store each obstacle's local `vertices` (a `PackedVector2Array`) and translate them by the obstacle's `global_position` before feeding them into the source geometry data.
- Run the project with `godot --headless` for verification; do not rely on rendering.

## Acceptance Criteria
- Project path: `/home/user/godot_project`.
- Command: `godot --headless --path /home/user/godot_project --script res://tests/run_tests.gd` (verifier-provided harness; do not modify it).
- Scene `res://scenes/nav_world.tscn` exists with the following node tree (exact names and types):
  - `NavWorld` (`Node2D`, script `res://scripts/nav_world.gd`, `class_name NavWorld`).
    - `Region` (`NavigationRegion2D`, with an initial `NavigationPolygon`).
    - `Obstacles` (`Node2D`) containing at least two children that are `NavigationObstacle2D` named `Obstacle1` and `Obstacle2`. Each obstacle's `vertices` property must define a non-empty closed polygon in local coordinates.
    - `Agent` (`CharacterBody2D`, script `res://scripts/nav_agent.gd`, `class_name NavAgent`) at world position `(80, 300)`.
      - `NavigationAgent2D` (`NavigationAgent2D`) as a child of `Agent`.
    - `Goal` (`Marker2D`) at world position `(720, 300)`.
- `res://scripts/nav_agent.gd` defines `class_name NavAgent` (extends `CharacterBody2D`) and:
  - Exposes `movement_speed: float` (default `> 0`).
  - Exposes a public boolean `reached` that starts `false` and becomes `true` after the agent's `NavigationAgent2D.target_reached` signal fires.
  - Provides a method `set_destination(world_position: Vector2) -> void` that sets `NavigationAgent2D.target_position` to that world-space position.
  - In `_physics_process`, while the navigation map is ready and the navigation is not finished, integrates velocity toward `get_next_path_position()` and calls `move_and_slide()` to physically advance the body.
- `res://scripts/nav_world.gd` defines `class_name NavWorld` (extends `Node2D`) and:
  - Provides `rebake_navigation() -> void` that rebuilds the `Region`'s `NavigationPolygon` from the walkable rectangle `(0, 0)`–`(800, 600)` carved by each `Obstacles/*` `NavigationObstacle2D` (translated to world space) using `NavigationServer2D.bake_from_source_geometry_data` and assigns the result back to `Region.navigation_polygon`.
  - Provides `move_obstacle(obstacle_name: String, new_position: Vector2) -> void` that updates the named obstacle's `global_position` and then calls `rebake_navigation()`.
  - Provides `start_navigation() -> void` that calls `Agent.set_destination(Goal.global_position)`.
  - On `_ready`, performs an initial `rebake_navigation()` so the region is usable before any navigation queries.
- Headless behavior:
  - After instancing the scene and calling `start_navigation()`, the agent must converge on the goal under the initial obstacle layout (path must route around the obstacles) within the harness's time budget and set `reached = true`.
  - After calling `move_obstacle("Obstacle1", far_offscreen)` and `move_obstacle("Obstacle2", far_offscreen)` and then `start_navigation()` again from a reset agent position, the agent must again reach the goal and set `reached = true`.

