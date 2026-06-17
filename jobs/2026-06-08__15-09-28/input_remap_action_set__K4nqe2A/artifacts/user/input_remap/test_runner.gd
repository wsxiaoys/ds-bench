extends SceneTree

func _initialize() -> void:
	print("=== InputRemap test suite ===")
	var ok := true

	# Manually bootstrap the autoload since --script doesn't load autoloads.
	var remapper_script: GDScript = load("res://autoloads/InputRemapper.gd")
	var remapper: Node = remapper_script.new()
	remapper.name = "InputRemapper"
	get_root().add_child(remapper)
	# In _initialize(), _ready() is deferred. Call it manually so that
	# _capture_defaults() runs before the tests begin.
	remapper._ready()

	# --- 1. All six actions exist ---
	var actions: Array[StringName] = [
		&"move_up", &"move_down", &"move_left", &"move_right", &"interact", &"jump"
	]
	for a in actions:
		if not InputMap.has_action(a):
			printerr("FAIL: missing action ", a)
			ok = false
		else:
			print("OK: has_action ", a)

	# --- 2. rebind_action + signal ---
	# Use a Dictionary as a mutable reference box so the lambda can write back
	# to the outer scope (GDScript closures capture primitives by value).
	var sig_box: Dictionary = {"fired": false, "action": &"", "event": null}
	remapper.action_rebound.connect(func(ac: StringName, ev: InputEvent) -> void:
		sig_box["fired"] = true
		sig_box["action"] = ac
		sig_box["event"] = ev
	)

	var key_x := InputEventKey.new()
	key_x.keycode = KEY_X
	remapper.rebind_action(&"jump", key_x)

	var jump_events := InputMap.action_get_events(&"jump")
	var has_x := false
	var has_space := false
	for ev in jump_events:
		if ev is InputEventKey:
			if ev.keycode == KEY_X:
				has_x = true
			if ev.keycode == KEY_SPACE:
				has_space = true
	if not has_x:
		printerr("FAIL: jump should contain KEY_X after rebind")
		ok = false
	else:
		print("OK: jump has KEY_X after rebind")
	if has_space:
		printerr("FAIL: jump still contains KEY_SPACE after rebind")
		ok = false
	else:
		print("OK: jump no longer has KEY_SPACE after rebind")

	var sig_ev: InputEvent = sig_box["event"]
	if not sig_box["fired"] or sig_box["action"] != &"jump" \
			or not (sig_ev is InputEventKey and sig_ev.keycode == KEY_X):
		printerr("FAIL: action_rebound signal not fired correctly (fired=",
				sig_box["fired"], " action=", sig_box["action"], ")")
		ok = false
	else:
		print("OK: action_rebound signal fired correctly")

	# --- 3. save / load round-trip ---
	var tmp_path := "user://test_input_map.cfg"
	remapper.save_to_file(tmp_path)

	# Change jump to KEY_Z then restore.
	var key_z := InputEventKey.new()
	key_z.keycode = KEY_Z
	remapper.rebind_action(&"jump", key_z)

	var loaded: bool = remapper.load_from_file(tmp_path)
	if not loaded:
		printerr("FAIL: load_from_file returned false for existing file")
		ok = false
	else:
		print("OK: load_from_file returned true")

	var restored_events := InputMap.action_get_events(&"jump")
	var restored_x := false
	for ev in restored_events:
		if ev is InputEventKey and ev.keycode == KEY_X:
			restored_x = true
	if not restored_x:
		printerr("FAIL: load_from_file did not restore KEY_X for jump")
		ok = false
	else:
		print("OK: load_from_file restored KEY_X for jump")

	# Missing path → false.
	var missing: bool = remapper.load_from_file("user://nonexistent_xyz_abc.cfg")
	if missing:
		printerr("FAIL: load_from_file returned true for missing file")
		ok = false
	else:
		print("OK: load_from_file returns false for missing file")

	# --- 4. reset_to_defaults ---
	remapper.reset_to_defaults()
	var default_events := InputMap.action_get_events(&"jump")
	var has_default_space := false
	for ev in default_events:
		if ev is InputEventKey and ev.keycode == KEY_SPACE:
			has_default_space = true
	if not has_default_space:
		printerr("FAIL: reset_to_defaults did not restore KEY_SPACE for jump")
		ok = false
	else:
		print("OK: reset_to_defaults restored KEY_SPACE for jump")

	# --- 5. RemapButton scene ---
	var remap_scene: PackedScene = load("res://scenes/RemapButton.tscn")
	if remap_scene == null:
		printerr("FAIL: could not load RemapButton.tscn")
		ok = false
	else:
		var remap_btn = remap_scene.instantiate()
		remap_btn.action_name = &"interact"
		get_root().add_child(remap_btn)
		# Manually trigger _ready() since _initialize() defers it.
		remap_btn._ready()

		# Confirm the button label reflects the current binding.
		var cur_ev: InputEvent = remapper.get_action_event(&"interact")
		var expected_text: String = cur_ev.as_text() if cur_ev != null else "(unbound)"
		var btn_text: String = remap_btn.get_node("Button").text
		if btn_text != expected_text:
			printerr("FAIL: RemapButton label='", btn_text, "' expected='", expected_text, "'")
			ok = false
		else:
			print("OK: RemapButton displays correct binding text '", btn_text, "'")

		# Simulate pressing the button (enter listen mode) then feeding KEY_R.
		remap_btn._on_button_pressed()
		var key_r_event := InputEventKey.new()
		key_r_event.keycode = KEY_R
		key_r_event.pressed = true
		remap_btn._unhandled_input(key_r_event)

		var interact_events := InputMap.action_get_events(&"interact")
		var has_r := false
		for ev in interact_events:
			if ev is InputEventKey and ev.keycode == KEY_R:
				has_r = true
		if not has_r:
			printerr("FAIL: interact does not contain KEY_R after RemapButton capture")
			ok = false
		else:
			print("OK: interact contains KEY_R after RemapButton capture")

	print("=== ", ("ALL TESTS PASSED" if ok else "SOME TESTS FAILED"), " ===")
	quit(0 if ok else 1)
