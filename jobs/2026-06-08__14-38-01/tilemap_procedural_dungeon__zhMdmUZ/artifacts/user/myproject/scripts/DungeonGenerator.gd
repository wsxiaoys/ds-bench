extends Node
class_name DungeonGenerator

@export var seed: int = 12345
@export var width: int = 64
@export var height: int = 64
@export var wall_threshold: float = 0.0

var _rooms: Array[Rect2i] = []

func generate(target: TileMapLayer) -> void:
	target.clear()
	
	var noise = FastNoiseLite.new()
	noise.seed = seed
	
	var rng = RandomNumberGenerator.new()
	rng.seed = seed
	
	# Initial noise pass
	for x in range(width):
		for y in range(height):
			if x == 0 or x == width - 1 or y == 0 or y == height - 1:
				target.set_cell(Vector2i(x, y), 1, Vector2i(1, 0))
			else:
				var noise_val = noise.get_noise_2d(x, y)
				if noise_val >= wall_threshold:
					target.set_cell(Vector2i(x, y), 1, Vector2i(1, 0))
				else:
					target.set_cell(Vector2i(x, y), 0, Vector2i(0, 0))
					
	# Room carving
	_rooms.clear()
	var min_w = int(clamp(6, 3, width / 8.0))
	var max_w = int(clamp(12, 4, width / 4.0))
	var min_h = int(clamp(6, 3, height / 8.0))
	var max_h = int(clamp(12, 4, height / 4.0))
	if min_w > max_w:
		min_w = max_w
	if min_h > max_h:
		min_h = max_h
		
	var attempts = 0
	while _rooms.size() < 3 and attempts < 2000:
		attempts += 1
		var rw = rng.randi_range(min_w, max_w)
		var rh = rng.randi_range(min_h, max_h)
		var rx = rng.randi_range(1, width - rw - 1)
		var ry = rng.randi_range(1, height - rh - 1)
		var new_room = Rect2i(rx, ry, rw, rh)
		
		var overlaps = false
		for r in _rooms:
			if r.intersects(new_room):
				overlaps = true
				break
				
		if not overlaps:
			_rooms.append(new_room)
			
	# Carve the rooms
	for r in _rooms:
		for x in range(r.position.x, r.end.x):
			for y in range(r.position.y, r.end.y):
				target.set_cell(Vector2i(x, y), 0, Vector2i(0, 0))
				
	# Connect rooms with L-shaped corridors
	for i in range(_rooms.size() - 1):
		var rA = _rooms[i]
		var rB = _rooms[i+1]
		
		var cA = Vector2i(rA.position.x + rA.size.x / 2, rA.position.y + rA.size.y / 2)
		var cB = Vector2i(rB.position.x + rB.size.x / 2, rB.position.y + rB.size.y / 2)
		
		if rng.randf() < 0.5:
			_carve_h(target, cA.x, cB.x, cA.y)
			_carve_v(target, cA.y, cB.y, cB.x)
		else:
			_carve_v(target, cA.y, cB.y, cA.x)
			_carve_h(target, cA.x, cB.x, cB.y)

func _carve_h(target: TileMapLayer, x1: int, x2: int, y: int) -> void:
	var start_x = min(x1, x2)
	var end_x = max(x1, x2)
	for x in range(start_x, end_x + 1):
		target.set_cell(Vector2i(x, y), 0, Vector2i(0, 0))

func _carve_v(target: TileMapLayer, y1: int, y2: int, x: int) -> void:
	var start_y = min(y1, y2)
	var end_y = max(y1, y2)
	for y in range(start_y, end_y + 1):
		target.set_cell(Vector2i(x, y), 0, Vector2i(0, 0))

func count_floor_tiles(target: TileMapLayer) -> int:
	var count = 0
	var used_cells = target.get_used_cells()
	for coords in used_cells:
		if target.get_cell_source_id(coords) == 0:
			count += 1
	return count

func find_rooms() -> Array[Rect2i]:
	return _rooms
