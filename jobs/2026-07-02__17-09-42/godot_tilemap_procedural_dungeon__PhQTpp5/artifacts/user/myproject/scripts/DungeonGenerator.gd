extends Node
class_name DungeonGenerator
## Deterministic procedural dungeon generator.
##
## Writes one tile per cell to a [TileMapLayer] using a [FastNoiseLite] seeded
## with [member seed], then carves at least three non-overlapping rectangular
## rooms and connects them with straight L-shaped corridors.  All edge cells
## (the outermost ring) are forced to be walls regardless of the noise.

## RNG seed.  The same value always produces the same dungeon layout.
@export var seed: int = 12345
## Grid width in cells.
@export var width: int = 64
## Grid height in cells.
@export var height: int = 64
## Noise threshold in the [-1, 1] range.  Cells whose noise value is greater
## than this become floor tiles during the initial noise pass.
@export var wall_threshold: float = 0.0

# Minimum / maximum number of rooms to attempt to carve.
const MIN_ROOMS: int = 3
const MAX_ROOMS: int = 6
const MIN_ROOM_SIZE: int = 4
const MAX_ROOM_SIZE: int = 8

# Source IDs for the dungeon atlas.  These must match the order of the tiles
# in `tilesets/dungeon.tres`.
const FLOOR_SOURCE_ID: int = 0
const WALL_SOURCE_ID: int = 1
const DOOR_SOURCE_ID: int = 2

# Atlas coordinates for each tile in the 48x16 atlas (3 x 16x16 cells).
const FLOOR_ATLAS: Vector2i = Vector2i(0, 0)
const WALL_ATLAS: Vector2i = Vector2i(1, 0)
const DOOR_ATLAS: Vector2i = Vector2i(2, 0)

# Rectangles of the rooms carved by the most recent [method generate] call.
# Always sorted by ascending y then ascending x so the order is stable
# across runs with the same seed.
var _rooms: Array[Rect2i] = []

## Returns the rectangles of the rooms carved by the most recent
## [method generate] call.  The rectangles are pairwise non-overlapping and
## fully contained inside the interior region (1..width-2, 1..height-2).
func find_rooms() -> Array[Rect2i]:
	return _rooms.duplicate()

## Clears [param target] and writes the dungeon into it.  See class docs.
func generate(target: TileMapLayer) -> void:
	assert(target != null, "DungeonGenerator.generate: target TileMapLayer is null")
	assert(width > 2 and height > 2, "DungeonGenerator.generate: width and height must be > 2")

	# Reset state.
	target.clear()
	_rooms = [] as Array[Rect2i]
	var carved_rooms: Array[Rect2i] = []

	# --- 1. Noise pass ---------------------------------------------------
	# Build a FastNoiseLite seeded with the exported seed.  Same seed must
	# always yield the same noise field, so .seed is set explicitly.
	var noise := FastNoiseLite.new()
	noise.seed = seed
	noise.noise_type = FastNoiseLite.TYPE_PERLIN
	noise.frequency = 0.08
	noise.fractal_octaves = 1

	for y in range(height):
		for x in range(width):
			var coord := Vector2i(x, y)
			if _is_edge(x, y):
				# The outer ring is always walls.
				target.set_cell(coord, WALL_SOURCE_ID, WALL_ATLAS)
			else:
				var n: float = noise.get_noise_2d(float(x), float(y))
				if n > wall_threshold:
					target.set_cell(coord, FLOOR_SOURCE_ID, FLOOR_ATLAS)
				else:
					target.set_cell(coord, WALL_SOURCE_ID, WALL_ATLAS)

	# --- 2. Room carving -------------------------------------------------
	# Use a RandomNumberGenerator seeded with the same `seed` so the room
	# placement is fully deterministic.
	var rng := RandomNumberGenerator.new()
	rng.seed = seed

	var attempts: int = 0
	var max_attempts: int = 400
	while carved_rooms.size() < MAX_ROOMS and attempts < max_attempts:
		attempts += 1
		var rw: int = rng.randi_range(MIN_ROOM_SIZE, MAX_ROOM_SIZE)
		var rh: int = rng.randi_range(MIN_ROOM_SIZE, MAX_ROOM_SIZE)
		# Keep a 1-cell border from the dungeon walls.
		var rx: int = rng.randi_range(1, width - 2 - rw)
		var ry: int = rng.randi_range(1, height - 2 - rh)
		var candidate := Rect2i(rx, ry, rw, rh)

		# Reject rooms that overlap any previously carved room (with a 1-cell
		# gap so corridors have room to pass between them).
		var overlaps := false
		for existing in carved_rooms:
			if existing.grow(1).intersects(candidate):
				overlaps = true
				break
		if overlaps:
			continue

		carved_rooms.append(candidate)
		# Overwrite the room rectangle with floor tiles.
		for cy in range(candidate.position.y, candidate.position.y + candidate.size.y):
			for cx in range(candidate.position.x, candidate.position.x + candidate.size.x):
				target.set_cell(Vector2i(cx, cy), FLOOR_SOURCE_ID, FLOOR_ATLAS)

	# Guarantee the "at least three non-overlapping rooms" requirement even
	# when the RNG produces rejections.  Fall back to a deterministic grid
	# of three rooms if needed.
	if carved_rooms.size() < MIN_ROOMS:
		carved_rooms.clear()
		var fallback_specs: Array[Vector4i] = [
			Vector4i(2, 2, MIN_ROOM_SIZE, MIN_ROOM_SIZE),
			Vector4i(width / 2 - MIN_ROOM_SIZE / 2, height / 2 - MIN_ROOM_SIZE / 2, MIN_ROOM_SIZE, MIN_ROOM_SIZE),
			Vector4i(width - 2 - MIN_ROOM_SIZE, height - 2 - MIN_ROOM_SIZE, MIN_ROOM_SIZE, MIN_ROOM_SIZE),
		]
		for spec in fallback_specs:
			var rect := Rect2i(spec.x, spec.y, spec.z, spec.w)
			carved_rooms.append(rect)
			for cy in range(rect.position.y, rect.position.y + rect.size.y):
				for cx in range(rect.position.x, rect.position.x + rect.size.x):
					target.set_cell(Vector2i(cx, cy), FLOOR_SOURCE_ID, FLOOR_ATLAS)

	# Sort the rooms so the order is stable across runs and so corridor
	# connections form a deterministic chain.
	carved_rooms.sort_custom(_compare_rooms)
	_rooms = carved_rooms

	# --- 3. Corridor carving --------------------------------------------
	# Connect consecutive rooms with straight L-shaped corridors.
	for i in range(1, _rooms.size()):
		var prev_center: Vector2i = _room_center(_rooms[i - 1])
		var curr_center: Vector2i = _room_center(_rooms[i])
		_carve_l_corridor(target, prev_center, curr_center)

## Returns the number of cells on [param target] whose [code]source_id[/code]
## is [constant FLOOR_SOURCE_ID] (i.e. floor tiles).
func count_floor_tiles(target: TileMapLayer) -> int:
	assert(target != null, "DungeonGenerator.count_floor_tiles: target TileMapLayer is null")
	var count: int = 0
	for y in range(height):
		for x in range(width):
			if target.get_cell_source_id(Vector2i(x, y)) == FLOOR_SOURCE_ID:
				count += 1
	return count

# ---------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------

func _is_edge(x: int, y: int) -> bool:
	return x == 0 or x == width - 1 or y == 0 or y == height - 1

func _compare_rooms(a: Rect2i, b: Rect2i) -> bool:
	if a.position.y != b.position.y:
		return a.position.y < b.position.y
	return a.position.x < b.position.x

func _room_center(room: Rect2i) -> Vector2i:
	# Rect2i uses integer arithmetic; pick the floor of the centre so the
	# corridor always starts/ends inside the room.
	var cx: int = room.position.x + room.size.x / 2
	var cy: int = room.position.y + room.size.y / 2
	return Vector2i(cx, cy)

func _carve_l_corridor(target: TileMapLayer, a: Vector2i, b: Vector2i) -> void:
	# Horizontal leg first, then vertical leg.  Either order is fine; we
	# always choose "horizontal then vertical" so the result is deterministic.
	var x_start: int = mini(a.x, b.x)
	var x_end: int = maxi(a.x, b.x)
	var y_start: int = mini(a.y, b.y)
	var y_end: int = maxi(a.y, b.y)
	for x in range(x_start, x_end + 1):
		target.set_cell(Vector2i(x, a.y), FLOOR_SOURCE_ID, FLOOR_ATLAS)
	for y in range(y_start, y_end + 1):
		target.set_cell(Vector2i(b.x, y), FLOOR_SOURCE_ID, FLOOR_ATLAS)