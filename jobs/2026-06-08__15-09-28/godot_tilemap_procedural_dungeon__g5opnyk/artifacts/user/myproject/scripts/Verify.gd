## Verify.gd – headless acceptance-criteria harness for DungeonGenerator.
## Run with: godot --headless --path . --script res://scripts/Verify.gd
extends SceneTree

var _passed := 0
var _failed := 0

func _ok(label: String) -> void:
	print("[PASS] " + label)
	_passed += 1

func _fail(label: String, detail: String = "") -> void:
	print("[FAIL] " + label + ((" — " + detail) if detail else ""))
	_failed += 1

func _hash_layer(l: TileMapLayer, w: int, h: int) -> int:
	var s: int = 0
	for y in range(h):
		for x in range(w):
			var sid := l.get_cell_source_id(Vector2i(x, y))
			s = (s * 31 + x * 100003 + y * 700001 + sid * 997) & 0x7FFFFFFFFFFFFFFF
	return s

func _init() -> void:
	# -----------------------------------------------------------------------
	# 1. TileSet loads and exposes source_ids 0, 1, 2
	# -----------------------------------------------------------------------
	var ts: TileSet = load("res://tilesets/dungeon.tres")
	if ts == null:
		_fail("TileSet loads")
	else:
		_ok("TileSet loads")
		for sid in [0, 1, 2]:
			if ts.has_source(sid):
				_ok("TileSet has source_id %d" % sid)
			else:
				_fail("TileSet has source_id %d" % sid)

	# -----------------------------------------------------------------------
	# 2. DungeonGenerator can be instantiated
	# -----------------------------------------------------------------------
	var gen_script: GDScript = load("res://scripts/DungeonGenerator.gd")
	var gen: Node = gen_script.new()
	if gen == null:
		_fail("DungeonGenerator instantiates")
		quit(1)
		return
	_ok("DungeonGenerator instantiates")

	# -----------------------------------------------------------------------
	# 3. @export properties exist with defaults
	# -----------------------------------------------------------------------
	var props_ok := true
	if gen.get("seed") != 12345:        props_ok = false
	if gen.get("width") != 64:          props_ok = false
	if gen.get("height") != 64:         props_ok = false
	if gen.get("wall_threshold") != 0.0: props_ok = false
	if props_ok:
		_ok("@export defaults correct (seed=12345, width=64, height=64, wall_threshold=0.0)")
	else:
		_fail("@export defaults", "seed=%s width=%s height=%s threshold=%s" % [
			str(gen.get("seed")), str(gen.get("width")),
			str(gen.get("height")), str(gen.get("wall_threshold"))])

	# -----------------------------------------------------------------------
	# 4. generate() runs on a fresh TileMapLayer
	# -----------------------------------------------------------------------
	var layer := TileMapLayer.new()
	layer.tile_set = ts
	get_root().add_child(layer)
	gen.generate(layer)
	_ok("generate() executed without error")

	# -----------------------------------------------------------------------
	# 5. Edge cells are walls
	# -----------------------------------------------------------------------
	var W: int = gen.width
	var H: int = gen.height
	var edge_ok := true
	for x in range(W):
		if layer.get_cell_source_id(Vector2i(x, 0)) != 1:
			edge_ok = false
		if layer.get_cell_source_id(Vector2i(x, H - 1)) != 1:
			edge_ok = false
	for y in range(H):
		if layer.get_cell_source_id(Vector2i(0, y)) != 1:
			edge_ok = false
		if layer.get_cell_source_id(Vector2i(W - 1, y)) != 1:
			edge_ok = false
	if edge_ok:
		_ok("Edge cells are all walls (source_id=1)")
	else:
		_fail("Edge cells are all walls (source_id=1)")

	# -----------------------------------------------------------------------
	# 6. find_rooms() returns >= 3 non-overlapping rooms inside interior
	# -----------------------------------------------------------------------
	var rooms: Array[Rect2i] = gen.find_rooms()
	if rooms.size() >= 3:
		_ok("find_rooms() returns >= 3 rooms (got %d)" % rooms.size())
	else:
		_fail("find_rooms() returns >= 3 rooms", "got %d" % rooms.size())

	var interior := Rect2i(1, 1, W - 2, H - 2)
	var rooms_valid := true
	for i in range(rooms.size()):
		if not interior.encloses(rooms[i]):
			rooms_valid = false
			_fail("Room %d not inside interior" % i,
				  "room=%s interior=%s" % [str(rooms[i]), str(interior)])
		for j in range(i + 1, rooms.size()):
			if rooms[i].intersects(rooms[j]):
				rooms_valid = false
				_fail("Rooms %d and %d overlap" % [i, j])
	if rooms_valid and rooms.size() >= 3:
		_ok("All rooms inside interior and non-overlapping")

	# -----------------------------------------------------------------------
	# 7. count_floor_tiles >= sum of room areas
	# -----------------------------------------------------------------------
	var floor_count: int = gen.count_floor_tiles(layer)
	var room_area_sum: int = 0
	for r in rooms:
		room_area_sum += r.size.x * r.size.y
	if floor_count >= room_area_sum:
		_ok("count_floor_tiles (%d) >= room area sum (%d)" % [floor_count, room_area_sum])
	else:
		_fail("count_floor_tiles < room area sum", "%d < %d" % [floor_count, room_area_sum])

	# -----------------------------------------------------------------------
	# 8. Determinism: two generate() calls with seed=12345 produce same data
	# -----------------------------------------------------------------------
	var hash1 := _hash_layer(layer, W, H)

	var layer2 := TileMapLayer.new()
	layer2.tile_set = ts
	get_root().add_child(layer2)
	gen.generate(layer2)
	var hash2 := _hash_layer(layer2, W, H)

	if hash1 == hash2:
		_ok("Determinism: seed=12345 gives identical layout twice (hash=%d)" % hash1)
	else:
		_fail("Determinism: same seed gave different hashes", "%d vs %d" % [hash1, hash2])

	# -----------------------------------------------------------------------
	# 9. Different seed produces different data
	# -----------------------------------------------------------------------
	var gen2: Node = gen_script.new()
	gen2.seed = 99
	var layer3 := TileMapLayer.new()
	layer3.tile_set = ts
	get_root().add_child(layer3)
	gen2.generate(layer3)
	var hash3 := _hash_layer(layer3, W, H)

	if hash3 != hash1:
		_ok("Different seed (99) produces different layout (hash=%d)" % hash3)
	else:
		_fail("Different seed (99) should produce different layout", "hashes equal: %d" % hash3)

	# -----------------------------------------------------------------------
	# Summary
	# -----------------------------------------------------------------------
	print("")
	print("=== Results: %d passed, %d failed ===" % [_passed, _failed])
	quit(0 if _failed == 0 else 1)
