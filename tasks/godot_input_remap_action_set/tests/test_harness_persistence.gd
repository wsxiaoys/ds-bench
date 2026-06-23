extends Node


func _ready() -> void:
	var remapper := get_node_or_null("/root/InputRemapper")
	if remapper == null:
		printerr("FAIL: InputRemapper autoload not found at /root/InputRemapper")
		get_tree().quit(2)
		return

	# Start from a known state.
	remapper.call("reset_to_defaults")
	await get_tree().process_frame

	# 1) Rebind jump to KEY_X and save.
	var ev_x := InputEventKey.new()
	ev_x.keycode = KEY_X
	ev_x.pressed = true
	remapper.call("rebind_action", &"jump", ev_x)
	await get_tree().process_frame

	remapper.call("save_to_file")
	await get_tree().process_frame

	if not FileAccess.file_exists("user://input_map.cfg"):
		printerr("FAIL: save_to_file did not create user://input_map.cfg")
		get_tree().quit(3)
		return

	# 2) Rebind jump to KEY_Y to make sure load actually changes state back.
	var ev_y := InputEventKey.new()
	ev_y.keycode = KEY_Y
	ev_y.pressed = true
	remapper.call("rebind_action", &"jump", ev_y)
	await get_tree().process_frame

	var pre_load: Array = InputMap.action_get_events(&"jump")
	if not _events_contain_keycode(pre_load, KEY_Y):
		printerr("FAIL: after rebind to KEY_Y, jump should contain KEY_Y, got: ", _events_to_str(pre_load))
		get_tree().quit(4)
		return

	# 3) Load from the saved file; jump should revert to KEY_X.
	var load_ok = remapper.call("load_from_file")
	if not bool(load_ok):
		printerr("FAIL: load_from_file() returned false for an existing file")
		get_tree().quit(5)
		return

	await get_tree().process_frame

	var post_load: Array = InputMap.action_get_events(&"jump")
	if not _events_contain_keycode(post_load, KEY_X):
		printerr("FAIL: after load_from_file, jump should contain KEY_X, got: ", _events_to_str(post_load))
		get_tree().quit(6)
		return
	if _events_contain_keycode(post_load, KEY_Y):
		printerr("FAIL: after load_from_file, jump should NOT contain KEY_Y, got: ", _events_to_str(post_load))
		get_tree().quit(7)
		return

	# 4) Loading a non-existent file must return false.
	var missing_path := "user://__nope_input_map_does_not_exist.cfg"
	if FileAccess.file_exists(missing_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(missing_path))
	var load_missing = remapper.call("load_from_file", missing_path)
	if bool(load_missing):
		printerr("FAIL: load_from_file should return false for missing file, returned true")
		get_tree().quit(8)
		return

	print("PERSIST_OK")
	get_tree().quit(0)


func _events_contain_keycode(events: Array, kc: int) -> bool:
	for e in events:
		if e is InputEventKey and (e as InputEventKey).keycode == kc:
			return true
	return false


func _events_to_str(events: Array) -> String:
	var parts: Array = []
	for e in events:
		parts.append(str(e))
	return "[" + ", ".join(parts) + "]"
