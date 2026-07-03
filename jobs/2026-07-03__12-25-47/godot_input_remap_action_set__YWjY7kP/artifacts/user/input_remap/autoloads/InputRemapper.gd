extends Node

signal action_rebound(action: StringName, event: InputEvent)

var _defaults: Dictionary = {}

func _ready() -> void:
	_capture_defaults()

func _capture_defaults() -> void:
	_defaults.clear()
	for action in InputMap.get_actions():
		_defaults[action] = InputMap.action_get_events(action).duplicate()

func rebind_action(action: StringName, new_event: InputEvent) -> void:
	if not InputMap.has_action(action):
		return
	var events: Array = InputMap.action_get_events(action)
	for ev in events:
		if ev is InputEventKey or ev is InputEventJoypadButton:
			InputMap.action_erase_event(action, ev)
	InputMap.action_add_event(action, new_event)
	emit_signal("action_rebound", action, new_event)

func get_action_event(action: StringName) -> InputEvent:
	if not InputMap.has_action(action):
		return null
	var events: Array = InputMap.action_get_events(action)
	if events.is_empty():
		return null
	return events[0]

func save_to_file(path: String = "user://input_map.cfg") -> void:
	var cfg := ConfigFile.new()
	for action in InputMap.get_actions():
		var events: Array = InputMap.action_get_events(action)
		var serialized: Array = []
		for ev in events:
			if ev is InputEventKey:
				serialized.append({
					"type": "key",
					"keycode": ev.keycode,
					"physical_keycode": ev.physical_keycode,
				})
			elif ev is InputEventJoypadButton:
				serialized.append({
					"type": "joypad_button",
					"button_index": ev.button_index,
				})
		cfg.set_value(action, "events", serialized)
	cfg.save(path)

func load_from_file(path: String = "user://input_map.cfg") -> bool:
	if not FileAccess.file_exists(path):
		return false
	var cfg := ConfigFile.new()
	var err := cfg.load(path)
	if err != OK:
		return false
	for action in InputMap.get_actions():
		if not cfg.has_section(action):
			continue
		var serialized: Array = cfg.get_value(action, "events", [])
		var existing: Array = InputMap.action_get_events(action)
		for ev in existing:
			if ev is InputEventKey or ev is InputEventJoypadButton:
				InputMap.action_erase_event(action, ev)
		for entry in serialized:
			var ev: InputEvent = null
			var type_str: String = entry.get("type", "")
			if type_str == "key":
				var key_event := InputEventKey.new()
				key_event.keycode = int(entry.get("keycode", 0))
				key_event.physical_keycode = int(entry.get("physical_keycode", 0))
				ev = key_event
			elif type_str == "joypad_button":
				var joy_event := InputEventJoypadButton.new()
				joy_event.button_index = int(entry.get("button_index", 0))
				ev = joy_event
			if ev != null:
				InputMap.action_add_event(action, ev)
	return true

func reset_to_defaults() -> void:
	for action in InputMap.get_actions():
		if not _defaults.has(action):
			continue
		var existing: Array = InputMap.action_get_events(action)
		for ev in existing:
			if ev is InputEventKey or ev is InputEventJoypadButton:
				InputMap.action_erase_event(action, ev)
		for ev in _defaults[action]:
			InputMap.action_add_event(action, ev)
