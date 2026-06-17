extends SceneTree

## Verification harness for the DungeonGenerator project.
## Run with: godot --headless --path /home/user/myproject -s verify.gd

func _init() -> void:
	print("=== DungeonGenerator Verification ===")

	# Load the main scene
	var main_scene: PackedScene = load("res://scenes/Main.tscn")
	assert(main_scene != null, "Failed to load Main.tscn")
	var main: Node2D = main_scene.instantiate()
	assert(main != null, "Failed to instantiate Main.tscn")

	var generator = main.get_node("DungeonGenerator")
	var tilemap: TileMapLayer = main.get_node("TileMapLayer")

	# Verify generator properties
	assert(generator.seed == 12345, "Default seed should be 12345")
	assert(generator.width == 64, "Default width should be 64")
	assert(generator.height == 64, "Default height should be 64")
	assert(generator.wall_threshold == 0.0, "Default wall_threshold should be 0.0")

	# Run generate
	generator.generate(tilemap)

	# --- Test 1: Edge cells are walls ---
	print("Test 1: Edge cells are walls...")
	for x in range(64):
		assert(tilemap.get_cell_source_id(Vector2i(x, 0)) == 1, "Top edge cell (%d, 0) should be wall" % x)
		assert(tilemap.get_cell_source_id(Vector2i(x, 63)) == 1, "Bottom edge cell (%d, 63) should be wall" % x)
	for y in range(64):
		assert(tilemap.get_cell_source_id(Vector2i(0, y)) == 1, "Left edge cell (0, %d) should be wall" % y)
		assert(tilemap.get_cell_source_id(Vector2i(63, y)) == 1, "Right edge cell (63, %d) should be wall" % y)
	print("  PASSED")

	# --- Test 2: find_rooms returns >= 3 non-overlapping rooms ---
	print("Test 2: find_rooms()...")
	var rooms: Array = generator.find_rooms()
	assert(rooms.size() >= 3, "Expected at least 3 rooms, got %d" % rooms.size())
	print("  Room count: %d" % rooms.size())

	# Check rooms are non-overlapping
	for i in range(rooms.size()):
		var ri: Rect2i = rooms[i]
		# Check fully inside interior
		assert(ri.position.x >= 1, "Room %d x < 1" % i)
		assert(ri.position.y >= 1, "Room %d y < 1" % i)
		assert(ri.position.x + ri.size.x <= 63, "Room %d extends past right edge" % i)
		assert(ri.position.y + ri.size.y <= 63, "Room %d extends past bottom edge" % i)
		for j in range(i + 1, rooms.size()):
			var rj: Rect2i = rooms[j]
			assert(not ri.intersects(rj), "Rooms %d and %d overlap" % [i, j])
	print("  PASSED")

	# --- Test 3: count_floor_tiles >= sum of room areas ---
	print("Test 3: count_floor_tiles()...")
	var floor_count: int = generator.count_floor_tiles(tilemap)
	var room_area_sum: int = 0
	for r in rooms:
		room_area_sum += r.get_area()
	assert(floor_count >= room_area_sum, "Floor tiles (%d) should be >= room area sum (%d)" % [floor_count, room_area_sum])
	print("  Floor tiles: %d, Room area sum: %d" % [floor_count, room_area_sum])
	print("  PASSED")

	# --- Test 4: Determinism ---
	print("Test 4: Determinism...")
	# Generate again with same seed
	var tilemap2 := TileMapLayer.new()
	tilemap2.tile_set = tilemap.tile_set
	generator.generate(tilemap2)

	# Compute hash over all cells
	var hash1 := _hash_tilemap(tilemap, 64, 64)
	var hash2 := _hash_tilemap(tilemap2, 64, 64)
	assert(hash1 == hash2, "Same seed should produce identical dungeons")
	print("  Hash1: %d, Hash2: %d" % [hash1, hash2])
	print("  PASSED")

	# --- Test 5: Different seed produces different dungeon ---
	print("Test 5: Different seed produces different dungeon...")
	generator.seed = 99
	var tilemap3 := TileMapLayer.new()
	tilemap3.tile_set = tilemap.tile_set
	generator.generate(tilemap3)
	var hash3 := _hash_tilemap(tilemap3, 64, 64)
	assert(hash3 != hash1, "Different seeds should produce different dungeons")
	print("  Hash1: %d, Hash3: %d" % [hash1, hash3])
	print("  PASSED")

	# --- Test 6: TileSet loads with source_ids 0, 1, 2 ---
	print("Test 6: TileSet source_ids...")
	var ts: TileSet = load("res://tilesets/dungeon.tres")
	assert(ts != null, "Failed to load tileset")
	assert(ts.get_source_count() >= 1, "TileSet should have at least 1 source")
	var source_id: int = ts.get_source_id(0)
	var source = ts.get_source(source_id)
	assert(source is TileSetAtlasSource, "Source should be TileSetAtlasSource")
	var atlas: TileSetAtlasSource = source
	# Verify tiles at atlas coords (0,0), (1,0), (2,0) exist
	assert(atlas.has_tile(Vector2i(0, 0)), "Missing tile at atlas (0,0)")
	assert(atlas.has_tile(Vector2i(1, 0)), "Missing tile at atlas (1,0)")
	assert(atlas.has_tile(Vector2i(2, 0)), "Missing tile at atlas (2,0)")
	print("  PASSED")

	print("\n=== ALL TESTS PASSED ===")
	quit(0)


func _hash_tilemap(tm: TileMapLayer, w: int, h: int) -> int:
	var hsh: int = 0
	for x in range(w):
		for y in range(h):
			var sid: int = tm.get_cell_source_id(Vector2i(x, y))
			hsh = ((hsh * 31) + (x * 10007 + y * 31337 + sid * 17)) & 0x7FFFFFFF
	return hsh
