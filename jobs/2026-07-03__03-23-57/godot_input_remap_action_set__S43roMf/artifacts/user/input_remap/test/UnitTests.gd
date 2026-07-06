extends SceneTree

func _init() -> void:
	print("--- Starting Input Remap Unit Tests ---")
	
	# Wait one frame or run immediately. Since we are in _init of SceneTree, 
	# let's run immediately or on the next idle frame.
	# Let's defer to make sure REDACTEDloads are fully ready.
	call_deferred("run_tests")

func run_tests() -> void:
	var remapper = root.get_node_or_null("InputRemapper")
	if remapper == null:
		print("ERROR: InputRemapper REDACTEDload not found!")
		quit(1)
		return
	
	print("SUCCESS: InputRemapper REDACTEDload found.")
	
	# Test 1: get_action_event for move_up
	var up_event = remapper.get_action_event(&"move_up")
	if up_event is InputEventKey and up_event.keycode == KEY_W:
		print("SUCCESS: Default move_up is KEY_W.")
	else:
		print("ERROR: move_up default is not KEY_W! Got: ", up_event)
		quit(1)
		return
	
	# Test 2: rebind_action with signal check
	var signal_data = {
		"received": false,
		"action": &"",
		"event": null
	}
	
	remapper.action_rebound.connect(func(action, event):
		signal_data.received = true
		signal_data.action = action
		signal_data.event = event
	)
	
	var new_key = InputEventKey.new()
	new_key.keycode = KEY_I
	
	remapper.rebind_action(&"move_up", new_key)
	
	if signal_data.received and signal_data.action == &"move_up" and signal_data.event == new_key:
		print("SUCCESS: action_rebound signal emitted correctly.")
	else:
		print("ERROR: action_rebound signal not received or incorrect!")
		quit(1)
		return
	
	# Verify move_up is now KEY_I
	var current_up = remapper.get_action_event(&"move_up")
	if current_up is InputEventKey and current_up.keycode == KEY_I:
		print("SUCCESS: move_up rebound to KEY_I.")
	else:
		print("ERROR: move_up was not rebound to KEY_I!")
		quit(1)
		return
	
	# Test 3: save_to_file and load_from_file
	var test_path = "user://test_input_map.cfg"
	# Ensure any existing file is deleted first
	DirAccess.remove_absolute(test_path)
	
	remapper.save_to_file(test_path)
	
	var file_exists = FileAccess.file_exists(test_path)
	if file_exists:
		print("SUCCESS: Config file saved successfully.")
	else:
		print("ERROR: Config file not found after save!")
		quit(1)
		return
	
	# Let's reset to defaults first to change the current key
	remapper.reset_to_defaults()
	var reset_up = remapper.get_action_event(&"move_up")
	if reset_up is InputEventKey and reset_up.keycode == KEY_W:
		print("SUCCESS: reset_to_defaults restored KEY_W.")
	else:
		print("ERROR: reset_to_defaults failed to restore KEY_W!")
		quit(1)
		return
	
	# Now load from file (which had KEY_I)
	var load_success = remapper.load_from_file(test_path)
	if load_success:
		print("SUCCESS: load_from_file returned true.")
	else:
		print("ERROR: load_from_file returned false!")
		quit(1)
		return
	
	var loaded_up = remapper.get_action_event(&"move_up")
	if loaded_up is InputEventKey and loaded_up.keycode == KEY_I:
		print("SUCCESS: load_from_file restored KEY_I.")
	else:
		print("ERROR: load_from_file failed to restore KEY_I!")
		quit(1)
		return
	
	# Clean up test file
	DirAccess.remove_absolute(test_path)
	
	# Test 4: RemapButton instancing and behavior
	var btn_scene = load("res://scenes/RemapButton.tscn")
	if btn_scene == null:
		print("ERROR: Failed to load RemapButton.tscn!")
		quit(1)
		return
	
	var button = btn_scene.instantiate()
	if button == null:
		print("ERROR: Failed to instantiate RemapButton!")
		quit(1)
		return
	
	button.action_name = &"jump"
	root.add_child(button)
	
	# Verify initial text of button
	# Default jump is Space
	if button.text == "Space":
		print("SUCCESS: RemapButton displays initial action binding.")
	else:
		print("ERROR: RemapButton displays incorrect text: ", button.text)
		quit(1)
		return
	
	# Test listening state trigger
	button._pressed()
	if button._is_listening:
		print("SUCCESS: RemapButton entered listening state on press.")
	else:
		print("ERROR: RemapButton did not enter listening state!")
		quit(1)
		return
	
	if button.text == "Press any key/button...":
		print("SUCCESS: RemapButton displays waiting text.")
	else:
		print("ERROR: RemapButton text not updated to waiting message!")
		quit(1)
		return
	
	# Simulate unhandled input
	var test_jump_key = InputEventKey.new()
	test_jump_key.keycode = KEY_J
	test_jump_key.pressed = true
	
	button._unhandled_input(test_jump_key)
	
	if not button._is_listening:
		print("SUCCESS: RemapButton exited listening state after input.")
	else:
		print("ERROR: RemapButton is still listening after input!")
		quit(1)
		return
	
	var current_jump = remapper.get_action_event(&"jump")
	if current_jump is InputEventKey and current_jump.keycode == KEY_J:
		print("SUCCESS: RemapButton successfully triggered rebinding to KEY_J.")
	else:
		print("ERROR: Action 'jump' was not rebound to KEY_J!")
		quit(1)
		return
	
	if button.text == "J":
		print("SUCCESS: RemapButton updated text to 'J'.")
	else:
		print("ERROR: RemapButton text was not updated to J! Got: ", button.text)
		quit(1)
		return
	
	button.queue_free()
	
	# Reset back to defaults for final clean state
	remapper.reset_to_defaults()
	
	print("\n--- ALL TESTS PASSED SUCCESSFULLY! ---")
	quit(0)
