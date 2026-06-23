extends Node


func _ready() -> void:
	var remapper := get_node_or_null("/root/InputRemapper")
	if remapper == null:
		printerr("FAIL: InputRemapper autoload not found at /root/InputRemapper")
		get_tree().quit(2)
		return

	remapper.call("reset_to_defaults")
	await get_tree().process_frame

	var packed: PackedScene = load("res://scenes/RemapButton.tscn")
	if packed == null:
		printerr("FAIL: could not load res://scenes/RemapButton.tscn")
		get_tree().quit(3)
		return

	var button: Node = packed.instantiate()
	if not (button is Control):
		printerr("FAIL: RemapButton root must be a Control (or Control-derived), got: ", button.get_class())
		get_tree().quit(4)
		return

	if not "action_name" in button:
		printerr("FAIL: RemapButton script must declare an exported `action_name` property")
		get_tree().quit(5)
		return

	button.set("action_name", &"interact")
	get_tree().root.add_child(button)
	await get_tree().process_frame
	await get_tree().process_frame

	# Expected display text: at least one character from the current binding's as_text().
	var current_events: Array = InputMap.action_get_events(&"interact")
	if current_events.is_empty():
		printerr("FAIL: `interact` action has no events; cannot derive expected display text")
		get_tree().quit(6)
		return
	var current_event: InputEvent = current_events[0]
	var expected_text: String = current_event.as_text()

	var visible_text := _collect_visible_text(button)
	if not visible_text.contains(expected_text):
		printerr("FAIL: RemapButton visible text should contain `%s` (current binding as_text), collected text: `%s`" % [expected_text, visible_text])
		get_tree().quit(7)
		return

	# Trigger listening mode using whatever interface the executor exposed.
	var triggered := false
	if button.has_method("start_listening"):
		button.call("start_listening")
		triggered = true
	elif button.has_signal("pressed"):
		button.emit_signal("pressed")
		triggered = true
	if not triggered:
		printerr("FAIL: RemapButton has neither a `start_listening()` method nor a `pressed` signal to enter listening mode")
		get_tree().quit(8)
		return

	await get_tree().process_frame

	# Synthesize an unhandled InputEventKey for KEY_R.
	var ev_r := InputEventKey.new()
	ev_r.keycode = KEY_R
	ev_r.pressed = true

	# Deliver the event directly to the button. _unhandled_input is the documented hook.
	if button.has_method("_unhandled_input"):
		button.call("_unhandled_input", ev_r)
	elif button.has_method("_input"):
		button.call("_input", ev_r)
	else:
		printerr("FAIL: RemapButton script does not implement _unhandled_input or _input to capture key events")
		get_tree().quit(9)
		return

	await get_tree().process_frame
	await get_tree().process_frame

	var interact_events: Array = InputMap.action_get_events(&"interact")
	var has_r := false
	for e in interact_events:
		if e is InputEventKey and (e as InputEventKey).keycode == KEY_R:
			has_r = true
			break
	if not has_r:
		printerr("FAIL: after simulated press+key event, `interact` should bind to KEY_R, got: ", _events_to_str(interact_events))
		get_tree().quit(10)
		return

	print("REMAP_BUTTON_OK")
	get_tree().quit(0)


func _collect_visible_text(node: Node) -> String:
	var parts: Array = []
	if "text" in node:
		parts.append(String(node.get("text")))
	for child in node.get_children():
		if child is Node:
			parts.append(_collect_visible_text(child))
	return " | ".join(parts)


func _events_to_str(events: Array) -> String:
	var parts: Array = []
	for e in events:
		parts.append(str(e))
	return "[" + ", ".join(parts) + "]"
