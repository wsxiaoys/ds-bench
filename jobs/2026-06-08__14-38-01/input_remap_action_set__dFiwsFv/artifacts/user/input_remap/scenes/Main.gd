extends Node

func _ready() -> void:
	print("--- Starting Input Remap Tests ---")
	
	# Run tests
	var success = run_tests()
	
	if success:
		print("--- All Tests Passed Successfully! ---")
		get_tree().quit(0)
	else:
		print("--- Tests Failed! ---")
		get_tree().quit(1)

func run_tests() -> bool:
	# Test 1: All six required actions must satisfy InputMap.has_action(...) after startup
	print("Running Test 1: Check required actions exist...")
	var required_actions = [&"move_up", &"move_down", &"move_left", &"move_right", &"interact", &"jump"]
	for action in required_actions:
		if not InputMap.has_action(action):
			print("FAIL: Missing action: ", action)
			return false
	print("PASS: All required actions exist.")
	
	# Test 2: rebind_action and action_rebound signal
	print("Running Test 2: Test rebind_action & action_rebound signal...")
	var test_state = {
		"signal_fired": false,
		"signal_action": null,
		"signal_event": null
	}
	
	var on_rebound = func(act: StringName, ev: InputEvent):
		test_state.signal_fired = true
		test_state.signal_action = act
		test_state.signal_event = ev
	
	InputRemapper.action_rebound.connect(on_rebound)
	
	var new_key = InputEventKey.new()
	new_key.keycode = KEY_X
	
	InputRemapper.rebind_action(&"jump", new_key)
	
	InputRemapper.action_rebound.disconnect(on_rebound)
	
	if not test_state.signal_fired:
		print("FAIL: action_rebound signal did not fire")
		return false
	if test_state.signal_action != &"jump":
		print("FAIL: Signal action mismatch: ", test_state.signal_action)
		return false
	if test_state.signal_event != new_key:
		print("FAIL: Signal event mismatch")
		return false
		
	var events = InputMap.action_get_events(&"jump")
	var has_x = false
	var has_space = false
	for ev in events:
		if ev is InputEventKey:
			if ev.keycode == KEY_X:
				has_x = true
			if ev.keycode == KEY_SPACE:
				has_space = true
	
	if not has_x:
		print("FAIL: KEY_X not bound to jump")
		return false
	if has_space:
		print("FAIL: KEY_SPACE still bound to jump")
		return false
	print("PASS: rebind_action and action_rebound signal work correctly.")
	
	# Test 3: save_to_file and load_from_file
	print("Running Test 3: Test save_to_file and load_from_file...")
	var test_save_path = "user://test_input_map.cfg"
	var dir = DirAccess.open("user://")
	if dir and dir.file_exists("test_input_map.cfg"):
		dir.remove("test_input_map.cfg")
		
	# Currently jump is KEY_X. Save this.
	InputRemapper.save_to_file(test_save_path)
	
	# Rebind to KEY_Y
	var key_y = InputEventKey.new()
	key_y.keycode = KEY_Y
	InputRemapper.rebind_action(&"jump", key_y)
	
	var events_y = InputMap.action_get_events(&"jump")
	var has_y = false
	for ev in events_y:
		if ev is InputEventKey and ev.keycode == KEY_Y:
			has_y = true
	if not has_y:
		print("FAIL: KEY_Y not bound")
		return false
		
	# Load from file
	var loaded = InputRemapper.load_from_file(test_save_path)
	if not loaded:
		print("FAIL: Failed to load from file")
		return false
		
	# Verify jump is restored to KEY_X
	var events_restored = InputMap.action_get_events(&"jump")
	var has_restored_x = false
	for ev in events_restored:
		if ev is InputEventKey and ev.keycode == KEY_X:
			has_restored_x = true
	if not has_restored_x:
		print("FAIL: KEY_X not restored to jump after load")
		return false
		
	# load_from_file on a missing path returns false
	var missing_loaded = InputRemapper.load_from_file("user://non_existent_file.cfg")
	if missing_loaded:
		print("FAIL: load_from_file on missing path should return false")
		return false
	print("PASS: save_to_file and load_from_file work correctly.")
	
	# Test 4: reset_to_defaults
	print("Running Test 4: Test reset_to_defaults...")
	InputRemapper.reset_to_defaults()
	var events_defaults = InputMap.action_get_events(&"jump")
	var has_default_space = false
	for ev in events_defaults:
		if ev is InputEventKey and ev.keycode == KEY_SPACE:
			has_default_space = true
	if not has_default_space:
		print("FAIL: reset_to_defaults did not restore Space for jump")
		return false
	print("PASS: reset_to_defaults works correctly.")
	
	# Test 5: RemapButton.tscn
	print("Running Test 5: Test RemapButton.tscn...")
	var button_scene = load("res://scenes/RemapButton.tscn")
	if button_scene == null:
		print("FAIL: Could not load RemapButton.tscn")
		return false
		
	var button = button_scene.instantiate()
	button.action_name = &"interact"
	add_child(button)
	
	# Wait for ready or check text
	var expected_initial = OS.get_keycode_string(KEY_E)
	if button.text != expected_initial and button.text != "E":
		print("FAIL: Button text mismatch: expected E, got ", button.text)
		return false
		
	# Trigger listening mode
	button._pressed()
	if not button.is_listening:
		print("FAIL: Button should be listening")
		return false
	if button.text != "Press a key...":
		print("FAIL: Button text should be 'Press a key...', got ", button.text)
		return false
		
	# Send KEY_R via _unhandled_input
	var event_r = InputEventKey.new()
	event_r.keycode = KEY_R
	event_r.pressed = true
	
	button._unhandled_input(event_r)
	
	if button.is_listening:
		print("FAIL: Button should stop listening after key press")
		return false
		
	var events_interact = InputMap.action_get_events(&"interact")
	var has_r = false
	for ev in events_interact:
		if ev is InputEventKey and ev.keycode == KEY_R:
			has_r = true
	if not has_r:
		print("FAIL: KEY_R not bound to interact after button input")
		return false
		
	var expected_final = OS.get_keycode_string(KEY_R)
	if button.text != expected_final and button.text != "R":
		print("FAIL: Button text should be R, got ", button.text)
		return false
		
	print("PASS: RemapButton.tscn works correctly.")
	return true
