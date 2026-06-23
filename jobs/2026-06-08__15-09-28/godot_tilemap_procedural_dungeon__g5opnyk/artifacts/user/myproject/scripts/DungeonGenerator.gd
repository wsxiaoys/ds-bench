## DungeonGenerator.gd
## Deterministic procedural dungeon generator for Godot 4.
## Uses FastNoiseLite for base terrain, then carves rectangular rooms
## and connects them with L-shaped corridors.
class_name DungeonGenerator
extends Node

# ---------------------------------------------------------------------------
# Exported properties
# ---------------------------------------------------------------------------
@export var seed: int = 12345
@export var width: int = 64
@export var height: int = 64
@export var wall_threshold: float = 0.0

# ---------------------------------------------------------------------------
# Source IDs (must match dungeon.tres)
# ---------------------------------------------------------------------------
const SOURCE_FLOOR: int = 0
const SOURCE_WALL:  int = 1
const SOURCE_DOOR:  int = 2

# Atlas coords: every atlas source has only one tile at (0,0)
const ATLAS_ORIGIN := Vector2i(0, 0)

# ---------------------------------------------------------------------------
# Internal state
# ---------------------------------------------------------------------------
var _rooms: Array[Rect2i] = []

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

## Clears *target*, writes noise-based floor/wall, carves rooms & corridors.
func generate(target: TileMapLayer) -> void:
	_rooms.clear()
	target.clear()

	# --- 1. Noise pass ---
	var noise := FastNoiseLite.new()
	noise.noise_type = FastNoiseLite.TYPE_PERLIN
	noise.seed = seed
	noise.frequency = 0.1

	for y in range(height):
		for x in range(width):
			var coords := Vector2i(x, y)
			# Edge cells are always walls
			if x == 0 or x == width - 1 or y == 0 or y == height - 1:
				target.set_cell(coords, SOURCE_WALL, ATLAS_ORIGIN)
			else:
				var v: float = noise.get_noise_2d(float(x), float(y))
				if v > wall_threshold:
					target.set_cell(coords, SOURCE_FLOOR, ATLAS_ORIGIN)
				else:
					target.set_cell(coords, SOURCE_WALL, ATLAS_ORIGIN)

	# --- 2. Room placement (deterministic via seeded RNG) ---
	var rng := RandomNumberGenerator.new()
	rng.seed = seed

	# Attempt to place MIN_ROOMS rooms; retry on overlap up to MAX_TRIES times.
	const MIN_ROOMS: int = 3
	const MAX_TRIES: int = 200
	const ROOM_MIN_W: int = 4
	const ROOM_MAX_W: int = 10
	const ROOM_MIN_H: int = 4
	const ROOM_MAX_H: int = 8

	var placed: Array[Rect2i] = []
	var tries: int = 0
	while placed.size() < MIN_ROOMS and tries < MAX_TRIES:
		tries += 1
		var rw: int = rng.randi_range(ROOM_MIN_W, ROOM_MAX_W)
		var rh: int = rng.randi_range(ROOM_MIN_H, ROOM_MAX_H)
		# Rooms must stay strictly inside the border (1 .. width-2, 1 .. height-2)
		var rx: int = rng.randi_range(1, width  - 2 - rw)
		var ry: int = rng.randi_range(1, height - 2 - rh)
		var candidate := Rect2i(rx, ry, rw, rh)

		# Reject if it overlaps any already-placed room (include 1-cell margin)
		var overlap := false
		for existing in placed:
			var margin := existing.grow(1)
			if margin.intersects(candidate):
				overlap = true
				break
		if overlap:
			continue

		# Carve the room
		_carve_rect(target, candidate)
		placed.append(candidate)

	_rooms = placed

	# --- 3. Connect rooms with L-shaped corridors ---
	# Connect each consecutive pair of rooms centre-to-centre.
	for i in range(placed.size() - 1):
		var a: Rect2i = placed[i]
		var b: Rect2i = placed[i + 1]
		var ca := a.get_center()
		var cb := b.get_center()
		_carve_corridor(target, ca, cb)


## Returns the number of cells with source_id == SOURCE_FLOOR on *target*.
func count_floor_tiles(target: TileMapLayer) -> int:
	var count: int = 0
	for y in range(height):
		for x in range(width):
			if target.get_cell_source_id(Vector2i(x, y)) == SOURCE_FLOOR:
				count += 1
	return count


## Returns the room rectangles carved by the most recent generate() call.
func find_rooms() -> Array[Rect2i]:
	return _rooms.duplicate()


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

## Overwrites every cell in *rect* with floor tiles.
func _carve_rect(target: TileMapLayer, rect: Rect2i) -> void:
	for y in range(rect.position.y, rect.position.y + rect.size.y):
		for x in range(rect.position.x, rect.position.x + rect.size.x):
			target.set_cell(Vector2i(x, y), SOURCE_FLOOR, ATLAS_ORIGIN)


## Carves an L-shaped corridor from *from_pt* to *to_pt*:
## first horizontal then vertical (or vice-versa, also deterministic).
func _carve_corridor(target: TileMapLayer, from_pt: Vector2i, to_pt: Vector2i) -> void:
	# Horizontal segment
	var x_start: int = min(from_pt.x, to_pt.x)
	var x_end:   int = max(from_pt.x, to_pt.x)
	for x in range(x_start, x_end + 1):
		var coords := Vector2i(x, from_pt.y)
		if _in_interior(coords):
			target.set_cell(coords, SOURCE_FLOOR, ATLAS_ORIGIN)

	# Vertical segment
	var y_start: int = min(from_pt.y, to_pt.y)
	var y_end:   int = max(from_pt.y, to_pt.y)
	for y in range(y_start, y_end + 1):
		var coords := Vector2i(to_pt.x, y)
		if _in_interior(coords):
			target.set_cell(coords, SOURCE_FLOOR, ATLAS_ORIGIN)


## Returns true when *coords* is strictly inside the border ring.
func _in_interior(coords: Vector2i) -> bool:
	return coords.x > 0 and coords.x < width - 1 \
		and coords.y > 0 and coords.y < height - 1
