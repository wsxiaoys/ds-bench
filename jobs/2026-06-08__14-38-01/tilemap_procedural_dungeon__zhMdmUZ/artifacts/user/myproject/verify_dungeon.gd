@tool
extends SceneTree

func _init():
	print("--- Running Verification Tests ---")
	
	# Load the script directly
	var gen_script = load("res://scripts/DungeonGenerator.gd")
	if gen_script == null:
		print("FAIL: Could not load DungeonGenerator.gd")
		quit(1)
		return
	
	var gen = gen_script.new()
	if gen == null:
		print("FAIL: Could not instantiate DungeonGenerator")
		quit(1)
		return
		
	# Create a TileMapLayer dynamically
	var tilemap_layer = TileMapLayer.new()
	
	# Load tileset
	var tileset = load("res://tilesets/dungeon.tres")
	if tileset == null:
		print("FAIL: Could not load tilesets/dungeon.tres")
		quit(1)
		return
	tilemap_layer.tile_set = tileset
	
	# Test 1: Generate with seed 12345
	gen.seed = 12345
	gen.width = 64
	gen.height = 64
	gen.wall_threshold = 0.0
	
	gen.generate(tilemap_layer)
	
	# Check edge cells
	var edge_ok = true
	for x in range(gen.width):
		for y in range(gen.height):
			if x == 0 or x == gen.width - 1 or y == 0 or y == gen.height - 1:
				var sid = tilemap_layer.get_cell_source_id(Vector2i(x, y))
				if sid != 1:
					print("FAIL: Edge cell (", x, ",", y, ") has source_id ", sid, " instead of 1")
					edge_ok = false
	if edge_ok:
		print("PASS: All edge cells are walls.")
	else:
		quit(1)
		return
		
	# Check rooms
	var rooms = gen.find_rooms()
	print("Rooms found: ", rooms.size())
	if rooms.size() < 3:
		print("FAIL: Less than 3 rooms found: ", rooms.size())
		quit(1)
		return
		
	var rooms_ok = true
	var total_room_area = 0
	for i in range(rooms.size()):
		var r = rooms[i]
		total_room_area += r.size.x * r.size.y
		# Check fully contained inside interior region (1..width-2, 1..height-2)
		if r.position.x < 1 or r.position.y < 1 or r.end.x > gen.width - 1 or r.end.y > gen.height - 1:
			print("FAIL: Room ", i, " is not fully contained in interior: ", r)
			rooms_ok = false
		
		# Check overlap with other rooms
		for j in range(i + 1, rooms.size()):
			if r.intersects(rooms[j]):
				print("FAIL: Room ", i, " overlaps with Room ", j, ": ", r, " vs ", rooms[j])
				rooms_ok = false
				
	if rooms_ok:
		print("PASS: Rooms are pairwise non-overlapping and fully inside interior.")
	else:
		quit(1)
		return
		
	# Check floor tile count
	var floor_count = gen.count_floor_tiles(tilemap_layer)
	print("Floor tile count: ", floor_count)
	print("Total room area: ", total_room_area)
	if floor_count >= total_room_area:
		print("PASS: Floor tile count >= total room area.")
	else:
		print("FAIL: Floor tile count (", floor_count, ") is less than total room area (", total_room_area, ")")
		quit(1)
		return
		
	# Test Determinism
	var hash1 = get_layout_hash(tilemap_layer, gen.width, gen.height)
	print("Hash 1 (seed 12345): ", hash1)
	
	# Generate again with same seed
	gen.generate(tilemap_layer)
	var hash2 = get_layout_hash(tilemap_layer, gen.width, gen.height)
	print("Hash 2 (seed 12345): ", hash2)
	
	if hash1 == hash2:
		print("PASS: Generator is deterministic for seed 12345.")
	else:
		print("FAIL: Non-deterministic output for same seed 12345!")
		quit(1)
		return
		
	# Generate with seed 99
	gen.seed = 99
	gen.generate(tilemap_layer)
	var hash3 = get_layout_hash(tilemap_layer, gen.width, gen.height)
	print("Hash 3 (seed 99): ", hash3)
	
	if hash3 != hash1:
		print("PASS: Seed 99 produces a different layout than seed 12345.")
	else:
		print("FAIL: Seed 99 produced the exact same layout as seed 12345!")
		quit(1)
		return
		
	# Clean up
	gen.free()
	tilemap_layer.free()
	
	print("--- All Tests Passed Successfully! ---")
	quit(0)

func get_layout_hash(target: TileMapLayer, width: int, height: int) -> String:
	var data = []
	for x in range(width):
		for y in range(height):
			var coords = Vector2i(x, y)
			var source_id = target.get_cell_source_id(coords)
			data.append("%d,%d:%d" % [x, y, source_id])
	var full_str = ";".join(data)
	return full_str.md5_text()
