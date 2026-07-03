extends SceneTree

func _init():
	var ok: bool = true
	ok = ok and _test_round_trip(true)   # binary .res
	ok = ok and _test_round_trip(false)  # text .tres
	ok = ok and _test_extension_normalization()
	ok = ok and _test_hash()
	print("RESULT: ", "ALL PASS" if ok else "FAIL")
	quit(0 if ok else 1)


func _make_data() -> GameSaveData:
	var data: GameSaveData = GameSaveData.new()
	data.player_position = Vector2(12.5, -7.25)
	data.unlocked_levels = PackedStringArray(["level_1", "level_3", "boss"])
	data.last_played = 1715000000

	var a: ItemData = ItemData.new()
	a.id = "sword"
	a.quantity = 3
	a.rarity = 2

	var b: ItemData = ItemData.new()
	b.id = "potion"
	b.quantity = 10
	b.rarity = 1

	data.inventory = [a, b]
	return data


func _assert_equal(actual, expected, label: String) -> bool:
	if actual != expected:
		print("  FAIL %s: expected %s, got %s" % [label, str(expected), str(actual)])
		return false
	return true


func _check_structural(original: GameSaveData, loaded: GameSaveData, label: String) -> bool:
	var pass_: bool = true
	pass_ = pass_ and _assert_equal(loaded.player_position, original.player_position, label + ".player_position")
	pass_ = pass_ and _assert_equal(loaded.last_played, original.last_played, label + ".last_played")
	pass_ = pass_ and _assert_equal(loaded.unlocked_levels, original.unlocked_levels, label + ".unlocked_levels")
	pass_ = pass_ and _assert_equal(loaded.inventory.size(), original.inventory.size(), label + ".inventory.size()")
	if not pass_:
		return false
	for i in original.inventory.size():
		var oi: ItemData = original.inventory[i]
		var li = loaded.inventory[i]
		if not (li is Resource):
			print("  FAIL %s.inventory[%d]: not a Resource" % [label, i])
			return false
		var s = li.get_script()
		if s == null:
			print("  FAIL %s.inventory[%d]: no script" % [label, i])
			return false
		# Resolve the script path/name to the ItemData class.
		var is_item: bool = (li is ItemData)
		if not is_item:
			print("  FAIL %s.inventory[%d]: script does not resolve to ItemData (got %s)" % [label, i, str(s)])
			return false
		pass_ = pass_ and _assert_equal(li.id, oi.id, "%s.inventory[%d].id" % [label, i])
		pass_ = pass_ and _assert_equal(li.quantity, oi.quantity, "%s.inventory[%d].quantity" % [label, i])
		pass_ = pass_ and _assert_equal(li.rarity, oi.rarity, "%s.inventory[%d].rarity" % [label, i])
		if not pass_:
			return false
	return true


func _test_round_trip(binary: bool) -> bool:
	var label: String = "round_trip(%s)" % ("binary" if binary else "text")
	var sm: SaveManager = SaveManager.new()
	var original: GameSaveData = _make_data()
	var base_path: String = "user://test_savegame"
	var err: int = sm.save_to_disk(original, base_path, binary)
	if err != OK:
		print("  FAIL %s: save returned %d" % [label, err])
		return false
	# Verify the on-disk extension.
	var expected_ext: String = ".res" if binary else ".tres"
	if not FileAccess.file_exists(base_path + expected_ext):
		print("  FAIL %s: expected file %s missing" % [label, base_path + expected_ext])
		return false
	# Load using the bare path (no extension).
	var loaded: GameSaveData = sm.load_from_disk(base_path)
	if loaded == null:
		print("  FAIL %s: load returned null" % [label])
		return false
	if not _check_structural(original, loaded, label):
		return false
	print("  PASS %s" % label)
	return true


func _test_extension_normalization() -> bool:
	var label: String = "extension_normalization"
	var sm: SaveManager = SaveManager.new()
	var data: GameSaveData = _make_data()
	var pass_: bool = true

	# Save text with explicit .tres path, then load with explicit .tres path.
	var p_tres: String = "user://norm_save.tres"
	var err1: int = sm.save_to_disk(data, p_tres, false)
	pass_ = pass_ and (err1 == OK)
	pass_ = pass_ and FileAccess.file_exists("user://norm_save.tres")
	var l1: GameSaveData = sm.load_from_disk("user://norm_save.tres")
	pass_ = pass_ and (l1 != null)
	pass_ = pass_ and _check_structural(data, l1, label + "(.tres explicit)")

	# Save binary with explicit .res path, then load with explicit .res path.
	var p_res: String = "user://norm_save.res"
	var err2: int = sm.save_to_disk(data, p_res, true)
	pass_ = pass_ and (err2 == OK)
	pass_ = pass_ and FileAccess.file_exists("user://norm_save.res")
	var l2: GameSaveData = sm.load_from_disk("user://norm_save.res")
	pass_ = pass_ and (l2 != null)
	pass_ = pass_ and _check_structural(data, l2, label + "(.res explicit)")

	# Save binary with a .tres path -> must normalize to .res on disk.
	var err3: int = sm.save_to_disk(data, "user://normalize_me.tres", true)
	pass_ = pass_ and (err3 == OK)
	pass_ = pass_ and FileAccess.file_exists("user://normalize_me.res")
	pass_ = pass_ and not FileAccess.file_exists("user://normalize_me.tres")

	# Save text with a .res path -> must normalize to .tres on disk.
	var err4: int = sm.save_to_disk(data, "user://normalize_me2.res", false)
	pass_ = pass_ and (err4 == OK)
	pass_ = pass_ and FileAccess.file_exists("user://normalize_me2.tres")
	pass_ = pass_ and not FileAccess.file_exists("user://normalize_me2.res")

	if pass_:
		print("  PASS %s" % label)
	else:
		print("  FAIL %s" % label)
	return pass_


func _test_hash() -> bool:
	var label: String = "compute_hash"
	var sm: SaveManager = SaveManager.new()
	var d1: GameSaveData = _make_data()
	var d2: GameSaveData = _make_data()
	var h1: String = sm.compute_hash(d1)
	var h2: String = sm.compute_hash(d2)
	var pass_: bool = true
	pass_ = pass_ and _assert_equal(h1, h2, label + " identical")
	pass_ = pass_ and _assert_equal(h1.length(), 64, label + " length")
	pass_ = pass_ and _assert_equal(h1, h1.to_lower(), label + " lowercase")

	# Differing top-level field.
	var d3: GameSaveData = _make_data()
	d3.last_played = 999
	pass_ = pass_ and (sm.compute_hash(d3) != h1)

	# Differing nested item field (order preserved).
	var d4: GameSaveData = _make_data()
	d4.inventory[0].quantity = 99
	pass_ = pass_ and (sm.compute_hash(d4) != h1)

	# Differing item order.
	var d5: GameSaveData = _make_data()
	var tmp = d5.inventory[0]
	d5.inventory[0] = d5.inventory[1]
	d5.inventory[1] = tmp
	pass_ = pass_ and (sm.compute_hash(d5) != h1)

	# Differing unlocked_levels.
	var d6: GameSaveData = _make_data()
	d6.unlocked_levels = PackedStringArray(["level_1", "level_3"])
	pass_ = pass_ and (sm.compute_hash(d6) != h1)

	# Determinism: same content different instance -> same hash.
	pass_ = pass_ and (sm.compute_hash(d1) == h1)

	if pass_:
		print("  PASS %s" % label)
	else:
		print("  FAIL %s" % label)
	return pass_