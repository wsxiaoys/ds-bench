extends Node

var _test_count := 0
var _pass_count := 0
var _fail_count := 0


func _ready() -> void:
	# Wait a frame so autoloads are fully initialized
	await get_tree().process_frame

	print("\n=== Running Input Remap Tests ===\n")

	test_actions_exist()
	test_rebind_action()
	test_signal_fires()
	test_save_load()
	test_load_missing()
	test_reset_to_defaults()
	test_remap_button()

	print("\n=== Results: %d/%d passed, %d failed ===\n" % [_pass_count, _test_count, _fail_count])

	get_tree().quit()


func assert_true(condition: bool, description: String) -> void:
	_test_count += 1
	if condition:
		_pass_count += 1
		print("  PASS: %s" % description)
	else:
		_fail_count += 1
		push_error("  FAIL: %s" % description)


func test_actions_exist() -> void:
	print("Test: All six actions exist")
	for action_name: StringName in [&"move_up", &"move_down", &"move_left", &"move_right", &"interact", &"jump"]:
		assert_true(InputMap.has_action(action_name), "InputMap.has_action(%s)" % action_name)


func test_rebind_action() -> void:
	print("Test: rebind_action replaces keyboard events")
	InputRemapper.reset_to_defaults()

	var new_event := InputEventKey.new()
	new_event.keycode = Key.KEY_X
	new_event.pressed = true
	InputRemapper.rebind_action(&"jump", new_event)

	var events: Array = InputMap.action_get_events(&"jump")
	var has_x := false
	var has_space := false
	for ev in events:
		if ev is InputEventKey:
			if ev.keycode == Key.KEY_X:
				has_x = true
			if ev.keycode == Key.KEY_SPACE:
				has_space = true

	assert_true(has_x, "jump contains InputEventKey with keycode KEY_X")
	assert_true(not has_space, "jump does NOT contain InputEventKey with keycode KEY_SPACE")


func test_signal_fires() -> void:
	print("Test: action_rebound signal fires")
	var signal_action: StringName = &""
	var signal_event: InputEvent = null

	var callable := func(action: StringName, event: InputEvent):
		signal_action = action
		signal_event = event

	InputRemapper.action_rebound.connect(callable)

	var new_event := InputEventKey.new()
	new_event.keycode = Key.KEY_Y
	new_event.pressed = true
	InputRemapper.rebind_action(&"jump", new_event)

	assert_true(signal_action == &"jump", "Signal received action 'jump'")
	assert_true(signal_event is InputEventKey, "Signal received an InputEventKey")
	if signal_event is InputEventKey:
		assert_true((signal_event as InputEventKey).keycode == Key.KEY_Y, "Signal event has keycode KEY_Y")

	InputRemapper.action_rebound.disconnect(callable)
	InputRemapper.reset_to_defaults()


func test_save_load() -> void:
	print("Test: save_to_file and load_from_file")

	InputRemapper.reset_to_defaults()
	var new_event := InputEventKey.new()
	new_event.keycode = Key.KEY_X
	new_event.pressed = true
	InputRemapper.rebind_action(&"jump", new_event)

	InputRemapper.save_to_file("user://test_input_map.cfg")

	# Rebind to KEY_Y
	var other_event := InputEventKey.new()
	other_event.keycode = Key.KEY_Y
	other_event.pressed = true
	InputRemapper.rebind_action(&"jump", other_event)

	var events_before: Array = InputMap.action_get_events(&"jump")
	var has_y_before := false
	for ev in events_before:
		if ev is InputEventKey and ev.keycode == Key.KEY_Y:
			has_y_before = true
	assert_true(has_y_before, "Before load, jump has KEY_Y")

	var result := InputRemapper.load_from_file("user://test_input_map.cfg")
	assert_true(result, "load_from_file returns true for existing file")

	var events_after: Array = InputMap.action_get_events(&"jump")
	var has_x_after := false
	for ev in events_after:
		if ev is InputEventKey and ev.keycode == Key.KEY_X:
			has_x_after = true
	assert_true(has_x_after, "After load, jump has KEY_X (restored from save)")


func test_load_missing() -> void:
	print("Test: load_from_file returns false on missing path")
	var result := InputRemapper.load_from_file("user://nonexistent_file_12345.cfg")
	assert_true(result == false, "load_from_file returns false for missing file")


func test_reset_to_defaults() -> void:
	print("Test: reset_to_defaults restores original bindings")

	InputRemapper.reset_to_defaults()

	var new_event := InputEventKey.new()
	new_event.keycode = Key.KEY_X
	new_event.pressed = true
	InputRemapper.rebind_action(&"jump", new_event)

	var events_before: Array = InputMap.action_get_events(&"jump")
	var has_x := false
	for ev in events_before:
		if ev is InputEventKey and ev.keycode == Key.KEY_X:
			has_x = true
	assert_true(has_x, "Before reset, jump has KEY_X")

	InputRemapper.reset_to_defaults()

	var events_after: Array = InputMap.action_get_events(&"jump")
	var has_space := false
	for ev in events_after:
		if ev is InputEventKey and ev.keycode == Key.KEY_SPACE:
			has_space = true
	assert_true(has_space, "After reset, jump has KEY_SPACE (default)")


func test_remap_button() -> void:
	print("Test: RemapButton displays binding and captures input")

	var button_scene: PackedScene = load("res://scenes/RemapButton.tscn")
	var button: Button = button_scene.instantiate()
	button.action_name = &"interact"

	get_tree().root.add_child(button)
	await get_tree().process_frame

	# Verify it displays the current binding's as_text()
	var events: Array = InputMap.action_get_events(&"interact")
	var expected_text: String = events[0].as_text() if events.size() > 0 else "Unassigned"
	assert_true(button.text == expected_text, "RemapButton displays as_text(): '%s'" % button.text)

	# Enter listening mode
	button._listening = true
	button.text = "Listening..."

	# Simulate receiving an InputEventKey for KEY_R via _unhandled_input
	var input_event := InputEventKey.new()
	input_event.keycode = Key.KEY_R
	input_event.pressed = true

	button._unhandled_input(input_event)

	# Verify interact action now has KEY_R
	var events_after: Array = InputMap.action_get_events(&"interact")
	var has_r := false
	for ev in events_after:
		if ev is InputEventKey and ev.keycode == Key.KEY_R:
			has_r = true
	assert_true(has_r, "After RemapButton capture, interact has KEY_R")

	# Verify button is no longer in listening state
	assert_true(not button._listening, "RemapButton exits listening state after capture")

	# Clean up
	button.queue_free()
	await get_tree().process_frame

	InputRemapper.reset_to_defaults()