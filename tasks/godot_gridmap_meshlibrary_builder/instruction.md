# Procedural GridMap Level Builder (Godot 4)

## Background
Build a Godot 4 project that constructs a `MeshLibrary` entirely in code (no editor pre-bake), assigns it to a `GridMap`, and populates the grid from a deterministic JSON layout. The project must also expose a small public API to place, query, and remove cells at runtime.

## Requirements
- Godot 4 project that loads and runs headlessly.
- Project path: `/home/user/myproject`.
- A GDScript at `scripts/LevelBuilder.gd` that extends `Node3D` and exposes the public methods listed in Acceptance Criteria. The script must build a `MeshLibrary` with exactly three item IDs (`0`, `1`, `2`) using code-only meshes (e.g. `BoxMesh` or `ArrayMesh`), each with a distinct `StandardMaterial3D` `albedo_color`, and assign that library to a child `GridMap` node.
- A scene `scenes/Main.tscn` whose root uses `scripts/LevelBuilder.gd` and contains a child `GridMap` node accessible at the node path `GridMap` (relative to the root).
- A JSON layout file at `data/level.json` that describes the initial grid contents.
- The level layout must specify at least 8 cells, use at least all three item IDs `0`, `1`, and `2` somewhere, and place cells at multiple distinct `y` levels (i.e. it must not be a flat single-layer floor).

## Implementation Hints
- Use `MeshLibrary.create_item(id)` and `set_item_mesh(id, mesh)` to register meshes at runtime. Assign the resulting `MeshLibrary` via `GridMap.mesh_library`.
- `GridMap.set_cell_item(Vector3i(x, y, z), item_id)` writes a cell; `get_cell_item(Vector3i(x, y, z))` reads it. Empty cells return `GridMap.INVALID_CELL_ITEM` (which equals `-1`).
- Use `FileAccess.open(...)` + `JSON.parse_string(...)` to load `res://data/level.json`.
- Materials should be applied to each mesh so the three item IDs are visually distinct; the verifier reads back the material albedo colors and requires three distinct, non-default colors.
- The harness will instance `scenes/Main.tscn`, add it to the scene tree, and call `build()` once before exercising the public API. Do not perform the build inside `_ready` only — `build()` must be safe to call directly from an external caller and must populate the grid from `res://data/level.json` every time it is invoked.
- `place`, `remove`, and `get_item` must operate on the same child `GridMap` that `build()` populates.

## Acceptance Criteria
- Project path: `/home/user/myproject`
- The project is a valid Godot 4 project (`project.godot` at the project root) and loads cleanly using `godot --headless --path /home/user/myproject`.
- Required files:
  - `scripts/LevelBuilder.gd`
  - `scenes/Main.tscn`
  - `data/level.json`
- `data/level.json` is a JSON object of the shape:
  ```json
  {
    "cells": [
      { "id": 0, "x": 0, "y": 0, "z": 0 },
      ...
    ]
  }
  ```
  where each `id` is one of `0`, `1`, or `2` and `x`, `y`, `z` are integers. The list must contain at least 8 entries, use every id in `{0, 1, 2}`, and include cells on at least two different `y` levels.
- `scenes/Main.tscn` root uses `scripts/LevelBuilder.gd`, and has a child node named `GridMap` of class `GridMap` at the relative node path `GridMap`.
- `scripts/LevelBuilder.gd` exposes the following public methods (exact signatures, GDScript type hints required):
  - `build() -> void` — builds the `MeshLibrary` with item IDs `0`, `1`, `2` (each a code-created mesh with a distinct `StandardMaterial3D` `albedo_color`), assigns it to the child `GridMap`, clears any existing cells, and populates the `GridMap` from `res://data/level.json`.
  - `place(item_id: int, gx: int, gy: int, gz: int) -> void` — sets the cell at `(gx, gy, gz)` to `item_id` on the child `GridMap`.
  - `remove(gx: int, gy: int, gz: int) -> void` — clears the cell at `(gx, gy, gz)` on the child `GridMap`.
  - `get_item(gx: int, gy: int, gz: int) -> int` — returns the item id at `(gx, gy, gz)` on the child `GridMap`, or `-1` if the cell is empty.
- After `build()` is called:
  - For every entry `{id, x, y, z}` in `data/level.json`, both `GridMap.get_cell_item(Vector3i(x, y, z))` and `LevelBuilder.get_item(x, y, z)` return `id`.
  - The `GridMap`'s `mesh_library` exposes item IDs `0`, `1`, and `2`, each with a non-null `Mesh` whose surface material is a `StandardMaterial3D`, and the three albedo colors are pairwise distinct.
- Runtime API behavior:
  - Calling `place(2, gx, gy, gz)` on a coordinate that is not present in `data/level.json` causes both `GridMap.get_cell_item(Vector3i(gx, gy, gz))` and `LevelBuilder.get_item(gx, gy, gz)` to return `2`.
  - Calling `remove(x, y, z)` on a coordinate that was populated by the JSON causes both `GridMap.get_cell_item(Vector3i(x, y, z))` and `LevelBuilder.get_item(x, y, z)` to return `-1`.

