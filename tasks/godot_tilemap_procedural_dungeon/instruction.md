# Deterministic Procedural Dungeon Generator (Godot 4)

## Background
Build a deterministic procedural dungeon generator for a Godot 4 project, using `TileMapLayer` for the grid and `FastNoiseLite` for the base terrain. The generator must be seeded so that the same seed always produces the same dungeon layout.

## Requirements
- Create a valid Godot 4 project at `/home/user/myproject` that can run headlessly.
- Ship a `TileSet` resource at `/home/user/myproject/tilesets/dungeon.tres` that exposes at least three logical tiles addressable as `source_id` 0 (floor), 1 (wall), and 2 (door).
- Implement a `DungeonGenerator` node (a GDScript at `/home/user/myproject/scripts/DungeonGenerator.gd`) with `@export` properties `seed: int = 12345`, `width: int = 64`, `height: int = 64`, and `wall_threshold: float = 0.0`, and the following methods:
  - `generate(target: TileMapLayer) -> void` — clears the target and writes one tile per cell (`floor` or `wall`) using a `FastNoiseLite` seeded with the exported `seed`. After the noise pass, carve at least three non-overlapping rectangular rooms and connect them with straight L-shaped corridors. All edge cells (x == 0, x == width - 1, y == 0, y == height - 1) must be walls regardless of noise.
  - `count_floor_tiles(target: TileMapLayer) -> int` — returns the number of cells whose `source_id` is `0` (floor) on the target layer. This count must be greater than or equal to the sum of the carved room areas (corridors add additional floor tiles).
  - `find_rooms() -> Array[Rect2i]` — returns the rectangles of the rooms carved by the most recent `generate()` call. The returned room rectangles must be `Rect2i` objects, pairwise non-overlapping, and fully contained inside the interior region `(1..width-2, 1..height-2)` (i.e. not touching the outer boundary wall cells).
- Provide a `scenes/Main.tscn` scene at `/home/user/myproject/scenes/Main.tscn` whose root wires a child `TileMapLayer` using the dungeon `TileSet` and a `DungeonGenerator` node, and triggers `generate()` on `_ready`.

## Implementation Hints
- The placeholder dungeon textures can be a single small PNG generated programmatically (for example, a 48x16 image of three solid 16x16 cells). Generate the PNG and the `TileSet` resource as part of the project bootstrap; do not commit hand-edited art.
- Use `FastNoiseLite` and explicitly set `.seed` from the exported `seed` so that the same seed always yields the same noise field.
- Use `TileMapLayer.set_cell(coords, source_id, atlas_coords)` to place tiles. Read back with `get_cell_source_id(coords)`.
- Determinism matters: the same `seed` must always produce the same tile data (same source IDs at the same coordinates) and the same set of room rectangles. Running `generate()` twice with the same seed must yield identical cell data (including positions and source IDs). Running with a different seed (e.g. `seed = 99`) must produce a different dungeon layout (different cell data).
- Carving a room means overwriting wall cells in its rectangle with floor; corridor carving should also write floor cells.
- The project must run with `godot --headless` (no display) and load `tilesets/dungeon.tres` as a `TileSet`. It must load and run without errors using `godot --headless --path /home/user/myproject`.
- The verifier will drive the project headlessly using a harness GDScript supplied at verification time; the agent does not need to write tests, but the project must expose the API exactly as described so the harness can call it.
