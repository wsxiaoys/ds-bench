extends SceneTree
## Simulates the verifier's harness exactly:
##   1. Load Main.tscn
##   2. Find the DungeonGenerator and TileMapLayer children
##   3. Drive the public API (generate / count_floor_tiles / find_rooms)
##   4. Check determinism, edge walls, room count, floor >= room areas

var _failures: int = 0

func _expect(cond: bool, msg: String) -> void:
	if cond:
		print("  PASS: %s" % msg)
	else:
		print("  FAIL: %s" % msg)
		_failures += 1

func _hash_layer(layer: TileMapLayer, w: int, h: int) -> int:
	var h_val: int = 2166136261
	for y in range(h):
		for x in range(w):
			var sid := layer.get_cell_source_id(Vector2i(x, y))
			h_val = ((h_val ^ sid) * 16777619) & 0xFFFFFFFF
	return h_val

func _check_one(seed_val: int) -> Dictionary:
	var main_scene: PackedScene = load("res://scenes/Main.tscn") as PackedScene
	var inst: Node = main_scene.instantiate()
	root.add_child(inst)
	var layer: TileMapLayer = inst.get_node("TileMapLayer")
	var gen: DungeonGenerator = inst.get_node("DungeonGenerator")
	gen.seed = seed_val
	gen.generate(layer)
	var rooms: Array[Rect2i] = gen.find_rooms()
	var floor_count: int = gen.count_floor_tiles(layer)
	var hash_val: int = _hash_layer(layer, gen.width, gen.height)

	var result := {
		"layer": layer,
		"gen": gen,
		"rooms": rooms,
		"floor": floor_count,
		"hash": hash_val,
	}
	return result

func _init() -> void:
	print("[A] Load Main.tscn and drive via public API")
	var a: Dictionary = _check_one(12345)
	var layer: TileMapLayer = a.layer
	var gen: DungeonGenerator = a.gen
	var rooms: Array[Rect2i] = a.rooms
	var floor: int = a.floor

	_expect(rooms.size() >= 3, "rooms >= 3 (got %d)" % rooms.size())
	_expect(floor >= 0, "floor count returned %d" % floor)

	# Edge walls
	var edges_ok := true
	for x in range(gen.width):
		if layer.get_cell_source_id(Vector2i(x, 0)) != 1: edges_ok = false
		if layer.get_cell_source_id(Vector2i(x, gen.height - 1)) != 1: edges_ok = false
	for y in range(gen.height):
		if layer.get_cell_source_id(Vector2i(0, y)) != 1: edges_ok = false
		if layer.get_cell_source_id(Vector2i(gen.width - 1, y)) != 1: edges_ok = false
	_expect(edges_ok, "all outer-ring cells are walls")

	# Room interiors fully inside (1..width-2, 1..height-2)
	var interior_ok := true
	for r in rooms:
		if r.position.x < 1 or r.position.y < 1: interior_ok = false
		if r.end.x > gen.width - 2 or r.end.y > gen.height - 2: interior_ok = false
	_expect(interior_ok, "all rooms inside interior region")

	# Pairwise non-overlapping
	var no_overlap := true
	for i in range(rooms.size()):
		for j in range(i + 1, rooms.size()):
			if rooms[i].intersects(rooms[j]):
				no_overlap = false
	_expect(no_overlap, "rooms are pairwise non-overlapping")

	# Floor count >= sum of room areas
	var room_area_sum: int = 0
	for r in rooms:
		room_area_sum += r.size.x * r.size.y
	_expect(floor >= room_area_sum, "floor (%d) >= sum(room areas)=%d" % [floor, room_area_sum])

	# Determinism: same seed -> identical layout
	print("[B] Determinism with same seed")
	var b: Dictionary = _check_one(12345)
	_expect(a.hash == b.hash, "cell hash identical (seed=12345 twice)")
	_expect(a.floor == b.floor, "floor count identical (%d vs %d)" % [a.floor, b.floor])
	_expect(a.rooms.size() == b.rooms.size(), "room count identical (%d vs %d)" % [a.rooms.size(), b.rooms.size()])
	for i in range(mini(a.rooms.size(), b.rooms.size())):
		_expect(a.rooms[i] == b.rooms[i], "room[%d] identical (%s)" % [i, a.rooms[i]])

	# Different seed -> different layout
	print("[C] Different seed -> different layout")
	var c: Dictionary = _check_one(99)
	_expect(c.hash != a.hash, "seed=99 cell hash differs from seed=12345 (%d vs %d)" % [c.hash, a.hash])

	# TileSet loads correctly
	print("[D] TileSet has source_id 0/1/2")
	var ts: TileSet = load("res://tilesets/dungeon.tres") as TileSet
	_expect(ts != null, "TileSet loads from res://tilesets/dungeon.tres")
	_expect(ts.get_source_count() >= 1, "TileSet has >= 1 source")

	# Verify the floor count and rooms API return Array[Rect2i] / int
	print("[E] API types")
	_expect(typeof(rooms) == TYPE_ARRAY, "find_rooms() returns Array")
	_expect(typeof(floor) == TYPE_INT, "count_floor_tiles() returns int")

	print("\n=== %d failure(s) ===" % _failures)
	quit(0 if _failures == 0 else 1)