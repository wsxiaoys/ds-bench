extends Node


func _ready() -> void:
	# 1) Verify the six required actions exist.
	var required_actions := [&"move_up", &"move_down", &"move_left", &"move_right", &"interact", &"jump"]
	for action in required_actions:
		if not InputMap.has_action(action):
			printerr("FAIL: missing required action: ", action)
			get_tree().quit(2)
			return

	# 2) Verify InputRemapper autoload + API surface.
	var remapper := get_node_or_null("/root/InputRemapper")
	if remapper == null:
		printerr("FAIL: InputRemapper autoload not found at /root/InputRemapper")
		get_tree().quit(3)
		return

	var required_methods := ["rebind_action", "get_action_event", "save_to_file", "load_from_file", "reset_to_defaults"]
	for m in required_methods:
		if not remapper.has_method(m):
			printerr("FAIL: InputRemapper missing required method: ", m)
			get_tree().quit(4)
			return

	if not remapper.has_signal("action_rebound"):
		printerr("FAIL: InputRemapper missing required signal: action_rebound")
		get_tree().quit(5)
		return

	# 3) Verify default jump binding is KEY_SPACE.
	var jump_events_initial: Array = InputMap.action_get_events(&"jump")
	if not _events_contain_keycode(jump_events_initial, KEY_SPACE):
		printerr("FAIL: default jump binding should include KEY_SPACE, got: ", _events_to_str(jump_events_initial))
		get_tree().quit(6)
		return

	# 4) Rebind jump to KEY_X and verify signal/state.
	var signal_calls: Array = []
	var receiver := _SignalReceiver.new(signal_calls)
	add_child(receiver)
	remapper.connect("action_rebound", Callable(receiver, "on_action_rebound"))

	var ev_x := InputEventKey.new()
	ev_x.keycode = KEY_X
	ev_x.pressed = true
	remapper.call("rebind_action", &"jump", ev_x)

	await get_tree().process_frame

	var jump_events_after: Array = InputMap.action_get_events(&"jump")
	if not _events_contain_keycode(jump_events_after, KEY_X):
		printerr("FAIL: after rebind, jump should have InputEventKey with keycode KEY_X, got: ", _events_to_str(jump_events_after))
		get_tree().quit(7)
		return
	if _events_contain_keycode(jump_events_after, KEY_SPACE):
		printerr("FAIL: after rebind, jump should NOT still contain KEY_SPACE, got: ", _events_to_str(jump_events_after))
		get_tree().quit(8)
		return

	if signal_calls.size() != 1:
		printerr("FAIL: expected action_rebound to fire exactly once, got %d (values=%s)" % [signal_calls.size(), str(signal_calls)])
		get_tree().quit(9)
		return
	var call_action: StringName = signal_calls[0][0]
	var call_event: InputEvent = signal_calls[0][1]
	if String(call_action) != "jump":
		printerr("FAIL: action_rebound emitted with wrong action: %s" % [str(call_action)])
		get_tree().quit(10)
		return
	if not (call_event is InputEventKey) or (call_event as InputEventKey).keycode != KEY_X:
		printerr("FAIL: action_rebound emitted with wrong event: %s" % [str(call_event)])
		get_tree().quit(11)
		return

	# 5) Verify get_action_event returns the new event.
	var fetched: InputEvent = remapper.call("get_action_event", &"jump")
	if not (fetched is InputEventKey) or (fetched as InputEventKey).keycode != KEY_X:
		printerr("FAIL: get_action_event(&\"jump\") should return InputEventKey(KEY_X), got: ", str(fetched))
		get_tree().quit(12)
		return

	# 6) Reset to defaults restores KEY_SPACE for jump.
	remapper.call("reset_to_defaults")
	await get_tree().process_frame

	var jump_events_reset: Array = InputMap.action_get_events(&"jump")
	if not _events_contain_keycode(jump_events_reset, KEY_SPACE):
		printerr("FAIL: reset_to_defaults should restore KEY_SPACE for jump, got: ", _events_to_str(jump_events_reset))
		get_tree().quit(13)
		return
	if _events_contain_keycode(jump_events_reset, KEY_X):
		printerr("FAIL: reset_to_defaults should remove KEY_X from jump, got: ", _events_to_str(jump_events_reset))
		get_tree().quit(14)
		return

	print("ACTIONS_OK")
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


class _SignalReceiver extends Node:
	var sink: Array

	func _init(arr: Array) -> void:
		sink = arr

	func on_action_rebound(action, event) -> void:
		sink.append([action, event])
