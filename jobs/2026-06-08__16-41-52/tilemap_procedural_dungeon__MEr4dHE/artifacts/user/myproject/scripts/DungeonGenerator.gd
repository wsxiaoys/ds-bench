extends Node
class_name DungeonGenerator

## Deterministic procedural dungeon generator using FastNoiseLite.
##
## Generates a dungeon on a TileMapLayer using noise-based terrain,
## room carving, and L-shaped corridor connections.

@export var seed: int = 12345
@export var width: int = 64
@export var height: int = 64
@export var wall_threshold: float = 0.0

## Tile source IDs
const FLOOR: int = 0
const WALL: int = 1
const DOOR: int = 2

## Rooms carved during the most recent generate() call
var _rooms: Array[Rect2i] = []


func generate(target: TileMapLayer) -> void:
	_rooms.clear()
	target.clear()

	# --- Phase 1: Noise-based terrain ---
	var noise := FastNoiseLite.new()
	noise.seed = seed
	noise.noise_type = FastNoiseLite.TYPE_PERLIN
	noise.frequency = 0.05

	for x in range(width):
		for y in range(height):
			var value: float = noise.get_noise_2d(x, y)
			if value >= wall_threshold:
				target.set_cell(Vector2i(x, y), WALL, Vector2i(1, 0))
			else:
				target.set_cell(Vector2i(x, y), FLOOR, Vector2i(0, 0))

	# --- Phase 2: Enforce walls on all edge cells ---
	for x in range(width):
		target.set_cell(Vector2i(x, 0), WALL, Vector2i(1, 0))
		target.set_cell(Vector2i(x, height - 1), WALL, Vector2i(1, 0))
	for y in range(height):
		target.set_cell(Vector2i(0, y), WALL, Vector2i(1, 0))
		target.set_cell(Vector2i(width - 1, y), WALL, Vector2i(1, 0))

	# --- Phase 3: Carve rooms ---
	# Use a deterministic RNG seeded from the generator seed
	var rng := RandomNumberGenerator.new()
	rng.seed = seed

	# Carve at least 3 non-overlapping rooms
	var room_count: int = rng.randi_range(3, 6)
	var attempts: int = 0
	var max_attempts: int = 200

	while _rooms.size() < room_count and attempts < max_attempts:
		attempts += 1

		# Random room dimensions
		var rw: int = rng.randi_range(5, 12)
		var rh: int = rng.randi_range(5, 9)

		# Random position within interior (leaving 1-cell border for walls)
		var rx: int = rng.randi_range(1, width - rw - 1)
		var ry: int = rng.randi_range(1, height - rh - 1)

		var candidate := Rect2i(rx, ry, rw, rh)

		# Check non-overlap with existing rooms (with 1-cell gap)
		var overlaps := false
		var padded := Rect2i(rx - 1, ry - 1, rw + 2, rh + 2)
		for existing in _rooms:
			if padded.intersects(existing):
				overlaps = true
				break

		if not overlaps:
			_rooms.append(candidate)
			# Carve the room: set all cells in rect to floor
			for cx in range(rx, rx + rw):
				for cy in range(ry, ry + rh):
					target.set_cell(Vector2i(cx, cy), FLOOR, Vector2i(0, 0))

	# --- Phase 4: Connect rooms with L-shaped corridors ---
	# Connect rooms sequentially: room[i] center -> room[i+1] center
	for i in range(_rooms.size() - 1):
		var a_center := _room_center(_rooms[i])
		var b_center := _room_center(_rooms[i + 1])
		_carve_l_corridor(target, a_center, b_center)


func _room_center(room: Rect2i) -> Vector2i:
	return Vector2i(room.position.x + room.size.x / 2, room.position.y + room.size.y / 2)


## Carve an L-shaped corridor from start to end.
## Moves horizontally first, then vertically.
func _carve_l_corridor(target: TileMapLayer, start: Vector2i, end: Vector2i) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed + start.x * 1000 + start.y + end.x * 100000 + end.y * 10

	var horizontal_first: bool = rng.randi() % 2 == 0

	if horizontal_first:
		_carve_horizontal(target, start.x, end.x, start.y)
		_carve_vertical(target, start.y, end.y, end.x)
	else:
		_carve_vertical(target, start.y, end.y, start.x)
		_carve_horizontal(target, start.x, end.x, end.y)


func _carve_horizontal(target: TileMapLayer, x1: int, x2: int, y: int) -> void:
	var step := 1 if x2 >= x1 else -1
	var x := x1
	while true:
		target.set_cell(Vector2i(x, y), FLOOR, Vector2i(0, 0))
		if x == x2:
			break
		x += step


func _carve_vertical(target: TileMapLayer, y1: int, y2: int, x: int) -> void:
	var step := 1 if y2 >= y1 else -1
	var y := y1
	while true:
		target.set_cell(Vector2i(x, y), FLOOR, Vector2i(0, 0))
		if y == y2:
			break
		y += step


func count_floor_tiles(target: TileMapLayer) -> int:
	var count := 0
	for x in range(width):
		for y in range(height):
			if target.get_cell_source_id(Vector2i(x, y)) == FLOOR:
				count += 1
	return count


func find_rooms() -> Array[Rect2i]:
	return _rooms.duplicate()
