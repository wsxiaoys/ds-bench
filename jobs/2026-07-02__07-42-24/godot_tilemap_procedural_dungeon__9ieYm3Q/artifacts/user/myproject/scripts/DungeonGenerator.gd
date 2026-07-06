class_name DungeonGenerator
extends Node

@export var seed: int = 12345
@export var width: int = 64
@export var height: int = 64
@export var wall_threshold: float = 0.0

var _rooms: Array[Rect2i] = []

func generate(target: TileMapLayer) -> void:
	# 1. Clear target
	target.clear()
	_rooms.clear()
	
	# 2. Setup FastNoiseLite
	var noise = FastNoiseLite.new()
	noise.seed = seed
	noise.noise_type = FastNoiseLite.TYPE_SIMPLEX
	noise.frequency = 0.1
	
	# 3. Base noise pass
	for x in range(width):
		for y in range(height):
			var val = noise.get_noise_2d(x, y)
			if val > wall_threshold:
				target.set_cell(Vector2i(x, y), 1, Vector2i(0, 0)) # Wall
			else:
				target.set_cell(Vector2i(x, y), 0, Vector2i(0, 0)) # Floor
				
	# 4. Generate rooms deterministically using a seeded RNG
	var rng = RandomNumberGenerator.new()
	rng.seed = seed
	
	var attempts = 0
	while _rooms.size() < 3 and attempts < 2000:
		attempts += 1
		# Room sizes between 5 and 12
		var rw = rng.randi_range(5, 12)
		var rh = rng.randi_range(5, 12)
		# Ensure rooms are fully inside the interior region (1..width-2, 1..height-2)
		# rx must be in [1, width - 1 - rw]
		# ry must be in [1, height - 1 - rh]
		if width - 1 - rw < 1 or height - 1 - rh < 1:
			continue
		var rx = rng.randi_range(1, width - 1 - rw)
		var ry = rng.randi_range(1, height - 1 - rh)
		
		var room = Rect2i(rx, ry, rw, rh)
		
		# Check overlap with existing rooms
		var overlaps = false
		for r in _rooms:
			if r.intersects(room):
				overlaps = true
				break
				
		if not overlaps:
			_rooms.append(room)
			
	# 5. Carve rooms
	for r in _rooms:
		for x in range(r.position.x, r.position.x + r.size.x):
			for y in range(r.position.y, r.position.y + r.size.y):
				target.set_cell(Vector2i(x, y), 0, Vector2i(0, 0))
				
	# 6. Carve corridors
	if _rooms.size() >= 3:
		# Connect Room 0 to Room 1
		_carve_l_corridor(target, _rooms[0], _rooms[1])
		# Connect Room 1 to Room 2
		_carve_l_corridor(target, _rooms[1], _rooms[2])
		
	# 7. Enforce outer boundary walls
	for x in range(width):
		target.set_cell(Vector2i(x, 0), 1, Vector2i(0, 0))
		target.set_cell(Vector2i(x, height - 1), 1, Vector2i(0, 0))
	for y in range(height):
		target.set_cell(Vector2i(0, y), 1, Vector2i(0, 0))
		target.set_cell(Vector2i(width - 1, y), 1, Vector2i(0, 0))

func _carve_l_corridor(target: TileMapLayer, r1: Rect2i, r2: Rect2i) -> void:
	var center_1 = r1.position + r1.size / 2
	var center_2 = r2.position + r2.size / 2
	
	# Horizontal then Vertical
	var start_x = min(center_1.x, center_2.x)
	var end_x = max(center_1.x, center_2.x)
	for x in range(start_x, end_x + 1):
		target.set_cell(Vector2i(x, center_1.y), 0, Vector2i(0, 0))
		
	var start_y = min(center_1.y, center_2.y)
	var end_y = max(center_1.y, center_2.y)
	for y in range(start_y, end_y + 1):
		target.set_cell(Vector2i(center_2.x, y), 0, Vector2i(0, 0))

func count_floor_tiles(target: TileMapLayer) -> int:
	var count = 0
	for x in range(width):
		for y in range(height):
			if target.get_cell_source_id(Vector2i(x, y)) == 0:
				count += 1
	return count

func find_rooms() -> Array[Rect2i]:
	return _rooms
