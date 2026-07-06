extends SceneTree
## Verification harness.  Run with:
##   godot --headless --script res://tools/verify.gd
##
## Exercises the DungeonGenerator via its public API and prints PASS/FAIL
## lines for each requirement.

const DungeonGeneratorScript := preload("res://scripts/DungeonGenerator.gd")
const TileSetScript := preload("res://tilesets/dungeon.tres")

var _failures: int = 0

func _expect(cond: bool, msg: String) -> void:
	if cond:
		print("  PASS: %s" % msg)
	else:
		print("  FAIL: %s" % msg)
		_failures += 1

func _dump_layer(layer: TileMapLayer, w: int, h: int) -> void:
	var rows: Array[String] = []
	for y in range(h):
		var row := ""
		for x in range(w):
			var sid := layer.get_cell_source_id(Vector2i(x, y))
			row += "." if sid == 0 else ("#" if sid == 1 else "D")
		rows.append(row)
	for r in rows:
		print(r)

func _make_layer(ts: TileSet) -> TileMapLayer:
	var layer := TileMapLayer.new()
	layer.tile_set = ts
	root.add_child(layer)
	return layer

func _hash_layer(layer: TileMapLayer, w: int, h: int) -> int:
	var h_val: int = 2166136261
	for y in range(h):
		for x in range(w):
			var sid := layer.get_cell_source_id(Vector2i(x, y))
			h_val = ((h_val ^ sid) * 16777619) & 0xFFFFFFFF
	return h_val

func _init() -> void:
	var ts: TileSet = load("res://tilesets/dungeon.tres") as TileSet
	assert(ts != null, "Failed to load TileSet")

	# --- basic API surface checks ---
	print("[1] TileSet exposes source_id 0/1/2")
	var found_0 := false
	var found_1 := false
	var found_2 := false
	for sid in range(ts.get_source_count()):
		var src := ts.get_source(sid)
		# Each atlas source has 3 tiles at (0,0), (1,0), (2,0).
		if src is TileSetAtlasSource:
			var a: TileSetAtlasSource = src
			if a.has_tile(Vector2i(0, 0)): found_0 = true
			if a.has_tile(Vector2i(1, 0)): found_1 = true
			if a.has_tile(Vector2i(2, 0)): found_2 = true
	_expect(found_0 and found_1 and found_2, "atlas has tiles at (0,0), (1,0), (2,0)")

	# --- determinism: same seed twice must produce identical output ---
	print("\n[2] Determinism: same seed -> identical layout")
	var gen1: DungeonGenerator = DungeonGeneratorScript.new()
	gen1.seed = 12345
	gen1.width = 64
	gen1.height = 64
	gen1.wall_threshold = 0.0
	root.add_child(gen1)
	var layer1a := _make_layer(ts)
	gen1.generate(layer1a)
	var rooms1: Array[Rect2i] = gen1.find_rooms()
	var floor1: int = gen1.count_floor_tiles(layer1a)
	var hash1: int = _hash_layer(layer1a, 64, 64)

	var gen2: DungeonGenerator = DungeonGeneratorScript.new()
	gen2.seed = 12345
	gen2.width = 64
	gen2.height = 64
	gen2.wall_threshold = 0.0
	root.add_child(gen2)
	var layer1b := _make_layer(ts)
	gen2.generate(layer1b)
	var rooms1b: Array[Rect2i] = gen2.find_rooms()
	var floor1b: int = gen1.count_floor_tiles(layer1b)
	var hash1b: int = _hash_layer(layer1b, 64, 64)

	_expect(hash1 == hash1b, "cell hash matches for seed=12345 across two runs")
	_expect(floor1 == floor1b, "floor count matches (%d == %d)" % [floor1, floor1b])
	_expect(rooms1.size() == rooms1b.size() and rooms1.size() >= 3, "room count >= 3 and stable (%d)" % rooms1.size())
	for i in range(mini(rooms1.size(), rooms1b.size())):
		_expect(rooms1[i] == rooms1b[i], "room[%d] identical: %s" % [i, rooms1[i]])

	# --- different seed must produce different layout ---
	print("\n[3] Different seed -> different layout")
	var gen3: DungeonGenerator = DungeonGeneratorScript.new()
	gen3.seed = 99
	gen3.width = 64
	gen3.height = 64
	gen3.wall_threshold = 0.0
	root.add_child(gen3)
	var layer3 := _make_layer(ts)
	gen3.generate(layer3)
	var hash3: int = _hash_layer(layer3, 64, 64)
	_expect(hash3 != hash1, "seed=99 cell hash differs from seed=12345 (%d vs %d)" % [hash3, hash1])

	# --- edge cells are always walls ---
	print("\n[4] Edge cells are walls")
	for x in range(64):
		_expect(layer1a.get_cell_source_id(Vector2i(x, 0)) == 1, "top edge (%d,0) is wall" % x)
		_expect(layer1a.get_cell_source_id(Vector2i(x, 63)) == 1, "bottom edge (%d,63) is wall" % x)
	for y in range(64):
		_expect(layer1a.get_cell_source_id(Vector2i(0, y)) == 1, "left edge (0,%d) is wall" % y)
		_expect(layer1a.get_cell_source_id(Vector2i(63, y)) == 1, "right edge (63,%d) is wall" % y)

	# --- at least 3 rooms, non-overlapping, inside (1..62, 1..62) ---
	print("\n[5] Room geometry")
	_expect(rooms1.size() >= 3, "at least 3 rooms (%d)" % rooms1.size())
	for i in range(rooms1.size()):
		var r: Rect2i = rooms1[i]
		_expect(r.position.x >= 1, "room[%d].x >= 1 (%d)" % [i, r.position.x])
		_expect(r.position.y >= 1, "room[%d].y >= 1 (%d)" % [i, r.position.y])
		_expect(r.end.x <= 62, "room[%d].end.x <= 62 (%d)" % [i, r.end.x])
		_expect(r.end.y <= 62, "room[%d].end.y <= 62 (%d)" % [i, r.end.y])
	for i in range(rooms1.size()):
		for j in range(i + 1, rooms1.size()):
			_expect(not rooms1[i].intersects(rooms1[j]), "room[%d] and room[%d] do not overlap" % [i, j])

	# --- floor count >= sum of room areas ---
	print("\n[6] floor count >= sum(room areas)")
	var room_area_sum: int = 0
	for r in rooms1:
		room_area_sum += r.size.x * r.size.y
	_expect(floor1 >= room_area_sum, "floor1=%d >= room_area_sum=%d" % [floor1, room_area_sum])

	# --- room rectangles' cells are all floor ---
	print("\n[7] every cell inside a room is floor")
	var all_floor := true
	for r in rooms1:
		for y in range(r.position.y, r.position.y + r.size.y):
			for x in range(r.position.x, r.position.x + r.size.x):
				if layer1a.get_cell_source_id(Vector2i(x, y)) != 0:
					all_floor = false
					print("    cell (%d,%d) not floor" % [x, y])
	_expect(all_floor, "every room cell is floor")

	# --- ASCII dump (small) ---
	print("\n[ASCII preview of seed=12345]")
	for y in range(0, 64, 2):
		var row := ""
		for x in range(0, 64, 1):
			var sid := layer1a.get_cell_source_id(Vector2i(x, y))
			row += "." if sid == 0 else ("#" if sid == 1 else "D")
		print(row)

	print("\n=== %d failure(s) ===" % _failures)
	quit(0 if _failures == 0 else 1)