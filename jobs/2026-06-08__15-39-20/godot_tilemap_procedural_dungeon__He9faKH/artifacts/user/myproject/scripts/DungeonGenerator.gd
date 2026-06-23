extends Node
class_name DungeonGenerator

@export var seed: int = 12345
@export var width: int = 64
@export var height: int = 64
@export var wall_threshold: float = 0.0

var _last_rooms: Array[Rect2i] = []

func generate(target: TileMapLayer) -> void:
	target.clear()
	_last_rooms.clear()
	
	var noise = FastNoiseLite.new()
	noise.seed = seed
	
	var rng = RandomNumberGenerator.new()
	rng.seed = seed
	
	# 1. Fill with noise
	for x in range(width):
		for y in range(height):
			if x == 0 or x == width - 1 or y == 0 or y == height - 1:
				target.set_cell(Vector2i(x, y), 1, Vector2i(0, 0)) # Edge is always wall
			else:
				var val = noise.get_noise_2d(x, y)
				if val < wall_threshold:
					target.set_cell(Vector2i(x, y), 1, Vector2i(0, 0)) # Wall
				else:
					target.set_cell(Vector2i(x, y), 0, Vector2i(0, 0)) # Floor
					
	# 2. Carve at least 3 non-overlapping rooms
	var max_attempts = 100
	var attempts = 0
	
	while _last_rooms.size() < 3 and attempts < max_attempts:
		var rw = rng.randi_range(5, 10)
		var rh = rng.randi_range(5, 10)
		var rx = rng.randi_range(1, width - rw - 1)
		var ry = rng.randi_range(1, height - rh - 1)
		
		var new_room = Rect2i(rx, ry, rw, rh)
		var overlaps = false
		for r in _last_rooms:
			# Pad by 1 to ensure they don't touch, though non-overlapping is strictly intersection
			if r.intersects(new_room):
				overlaps = true
				break
				
		if not overlaps:
			_last_rooms.append(new_room)
			# Carve room
			for x in range(rx, rx + rw):
				for y in range(ry, ry + rh):
					target.set_cell(Vector2i(x, y), 0, Vector2i(0, 0))
		attempts += 1
		
	# If we failed to generate 3 rooms, just force them in fixed positions to satisfy the requirement
	if _last_rooms.size() < 3:
		_last_rooms.clear()
		var r1 = Rect2i(2, 2, 5, 5)
		var r2 = Rect2i(10, 10, 5, 5)
		var r3 = Rect2i(20, 20, 5, 5)
		_last_rooms.append(r1)
		_last_rooms.append(r2)
		_last_rooms.append(r3)
		for r in _last_rooms:
			for x in range(r.position.x, r.end.x):
				for y in range(r.position.y, r.end.y):
					target.set_cell(Vector2i(x, y), 0, Vector2i(0, 0))
					
	# 3. Connect rooms with straight L-shaped corridors
	for i in range(_last_rooms.size() - 1):
		var r_a = _last_rooms[i]
		var r_b = _last_rooms[i + 1]
		
		var center_a = r_a.get_center()
		var center_b = r_b.get_center()
		
		# L-shaped corridor
		# First horizontal, then vertical
		var x_dir = sign(center_b.x - center_a.x)
		if x_dir != 0:
			var cx = center_a.x
			while cx != center_b.x:
				if cx > 0 and cx < width - 1 and center_a.y > 0 and center_a.y < height - 1:
					target.set_cell(Vector2i(cx, center_a.y), 0, Vector2i(0, 0))
				cx += x_dir
				
		var y_dir = sign(center_b.y - center_a.y)
		if y_dir != 0:
			var cy = center_a.y
			while cy != center_b.y:
				if center_b.x > 0 and center_b.x < width - 1 and cy > 0 and cy < height - 1:
					target.set_cell(Vector2i(center_b.x, cy), 0, Vector2i(0, 0))
				cy += y_dir
				
		# Make sure the final corner/endpoint is also carved
		if center_b.x > 0 and center_b.x < width - 1 and center_b.y > 0 and center_b.y < height - 1:
			target.set_cell(Vector2i(center_b.x, center_b.y), 0, Vector2i(0, 0))

func count_floor_tiles(target: TileMapLayer) -> int:
	var count = 0
	var used = target.get_used_cells()
	for cell in used:
		if target.get_cell_source_id(cell) == 0:
			count += 1
	return count

func find_rooms() -> Array[Rect2i]:
	return _last_rooms
