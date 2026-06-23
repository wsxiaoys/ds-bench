extends Node

var _failed := 0
var _passed := 0

# Hold a reference so the lambda isn't garbage-collected.
var _signal_captured: Callable


func _ready() -> void:
	_test_all_actions_exist()
	_test_rebind_jump()
	_test_save_load()
	_test_load_missing_returns_false()
	_test_reset_to_defaults()
	_test_remap_button_scene()
	_print_summary()
	get_tree().quit(_failed)


func _assert(condition: bool, msg: String) -> void:
	if condition:
		_passed += 1
		print("  PASS: %s" % msg)
	else:
		_failed += 1
		printerr("  FAIL: %s" % msg)


func _test_all_actions_exist() -> void:
	print("== Test: all six actions exist ==")
	var required := ["move_up", "move_down", "move_left", "move_right", "interact", "jump"]
	for name in required:
		_assert(InputMap.has_action(name), "InputMap.has_action('%s')" % name)


func _test_rebind_jump() -> void:
	print("== Test: rebind jump to KEY_X ==")

	# Connect to signal to verify it fires.
	var signal_fired := false
	var fired_action: StringName = &""
	var fired_event: InputEvent = null

	_signal_captured = func(action, event):
		signal_fired = true
		fired_action = action
		fired_event = event

	InputRemapper.action_rebound.connect(_signal_captured)

	# Verify default binding is Space (physical_keycode 32 / KEY_SPACE).
	var default_events := InputMap.action_get_events(&"jump")
	var has_space := false
	for ev in default_events:
		if ev is InputEventKey and ev.physical_keycode == KEY_SPACE:
			has_space = true
			break
	_assert(has_space, "jump default binding is KEY_SPACE")

	# Rebind to KEY_X.
	var ev_x := InputEventKey.new()
	ev_x.physical_keycode = KEY_X
	ev_x.keycode = KEY_X
	InputRemapper.rebind_action(&"jump", ev_x)

	# Check the binding.
	var events := InputMap.action_get_events(&"jump")
	var has_x := false
	var has_space_still := false
	for ev in events:
		if ev is InputEventKey:
			if ev.physical_keycode == KEY_X:
				has_x = true
			if ev.physical_keycode == KEY_SPACE:
				has_space_still = true
	_assert(has_x, "jump now contains KEY_X")
	_assert(not has_space_still, "jump no longer contains KEY_SPACE")

	# Check signal.
	_assert(signal_fired, "action_rebound signal fired")
	_assert(fired_action == &"jump", "signal action is 'jump'")
	_assert(fired_event is InputEventKey and fired_event.physical_keycode == KEY_X, "signal event is KEY_X")


func _test_save_load() -> void:
	print("== Test: save/load round-trip ==")

	# First, rebind jump to KEY_X and save.
	var ev_x := InputEventKey.new()
	ev_x.physical_keycode = KEY_X
	ev_x.keycode = KEY_X
	InputRemapper.rebind_action(&"jump", ev_x)

	InputRemapper.save_to_file("user://input_map.cfg")

	# Now rebind to something different (KEY_Y).
	var ev_y := InputEventKey.new()
	ev_y.physical_keycode = KEY_Y
	ev_y.keycode = KEY_Y
	InputRemapper.rebind_action(&"jump", ev_y)

	# Load should restore KEY_X.
	var ok := InputRemapper.load_from_file("user://input_map.cfg")
	_assert(ok, "load_from_file returned true")

	var events := InputMap.action_get_events(&"jump")
	var has_x := false
	for ev in events:
		if ev is InputEventKey and ev.physical_keycode == KEY_X:
			has_x = true
			break
	_assert(has_x, "after load, jump contains KEY_X")

	# Clean up the file.
	DirAccess.remove_absolute("user://input_map.cfg")


func _test_load_missing_returns_false() -> void:
	print("== Test: load_from_file on missing path ==")
	var ok := InputRemapper.load_from_file("user://__nonexistent__.cfg")
	_assert(not ok, "load_from_file returns false for missing file")


func _test_reset_to_defaults() -> void:
	print("== Test: reset_to_defaults ==")

	# Rebind jump to KEY_X.
	var ev_x := InputEventKey.new()
	ev_x.physical_keycode = KEY_X
	ev_x.keycode = KEY_X
	InputRemapper.rebind_action(&"jump", ev_x)

	# Reset.
	InputRemapper.reset_to_defaults()

	# Verify Space is back.
	var events := InputMap.action_get_events(&"jump")
	var has_space := false
	for ev in events:
		if ev is InputEventKey and ev.physical_keycode == KEY_SPACE:
			has_space = true
			break
	_assert(has_space, "after reset, jump contains KEY_SPACE")


func _test_remap_button_scene() -> void:
	print("== Test: RemapButton scene ==")

	var scene := load("res://scenes/RemapButton.tscn") as PackedScene
	_assert(scene != null, "RemapButton.tscn loads as PackedScene")

	var instance := scene.instantiate()
	_assert(instance is Control, "instance is Control")

	# Set action_name to interact.
	instance.action_name = &"interact"
	add_child(instance)

	# Wait a frame for _ready to run.
	await get_tree().process_frame

	# Check that the label shows the current binding text.
	var label: Label = instance.get_node("Label")
	_assert(label.text != "Unbound" and label.text != "", "label shows binding text (got '%s')" % label.text)

	# Simulate entering listening mode.
	instance._on_pressed()
	_assert(label.text == "Press a key...", "label shows 'Press a key...' after press")

	# Simulate an unhandled key event for KEY_R.
	var ev_r := InputEventKey.new()
	ev_r.physical_keycode = KEY_R
	ev_r.keycode = KEY_R
	ev_r.pressed = true
	instance._unhandled_input(ev_r)

	# Verify the binding changed.
	var events := InputMap.action_get_events(&"interact")
	var has_r := false
	for ev in events:
		if ev is InputEventKey and ev.physical_keycode == KEY_R:
			has_r = true
			break
	_assert(has_r, "after capturing KEY_R, interact contains KEY_R")

	# Clean up.
	instance.queue_free()


func _print_summary() -> void:
	print("")
	print("========================")
	print("  PASSED: %d" % _passed)
	print("  FAILED: %d" % _failed)
	print("========================")
