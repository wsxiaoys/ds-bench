extends SceneTree

func _init():
	print("Starting test...")
	var main_scene = load("res://scenes/Main.tscn")
	if not main_scene:
		print("Failed to load Main.tscn")
		quit()
		return
		
	var root = main_scene.instantiate()
	var generator = root.get_node("DungeonGenerator")
	var tilemap = root.get_node("TileMapLayer")
	
	generator.generate(tilemap)
	
	var floor_tiles = generator.count_floor_tiles(tilemap)
	var rooms = generator.find_rooms()
	
	print("Floor tiles: ", floor_tiles)
	print("Rooms: ", rooms.size())
	
	var w = generator.width
	var h = generator.height
	var edges_ok = true
	for x in range(w):
		if tilemap.get_cell_source_id(Vector2i(x, 0)) != 1: edges_ok = false
		if tilemap.get_cell_source_id(Vector2i(x, h - 1)) != 1: edges_ok = false
	for y in range(h):
		if tilemap.get_cell_source_id(Vector2i(0, y)) != 1: edges_ok = false
		if tilemap.get_cell_source_id(Vector2i(w - 1, y)) != 1: edges_ok = false
		
	print("Edges ok: ", edges_ok)
	
	# Hash
	var used = tilemap.get_used_cells()
	used.sort()
	var hash1 = 0
	for c in used:
		hash1 = hash1 ^ (c.x * 73856093 ^ c.y * 19349663 ^ tilemap.get_cell_source_id(c) * 83492791)
		
	print("Hash 1: ", hash1)
	
	generator.seed = 99
	generator.generate(tilemap)
	used = tilemap.get_used_cells()
	used.sort()
	var hash2 = 0
	for c in used:
		hash2 = hash2 ^ (c.x * 73856093 ^ c.y * 19349663 ^ tilemap.get_cell_source_id(c) * 83492791)
		
	print("Hash 2: ", hash2)
	
	quit()
