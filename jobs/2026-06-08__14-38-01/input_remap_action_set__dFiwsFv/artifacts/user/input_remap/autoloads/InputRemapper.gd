extends Node

signal action_rebound(action: StringName, event: InputEvent)

const ACTIONS = [&"move_up", &"move_down", &"move_left", &"move_right", &"interact", &"jump"]

var _defaults: Dictionary = {}

func _ready() -> void:
	for action in ACTIONS:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		var events: Array[InputEvent] = []
		for event in InputMap.action_get_events(action):
			events.append(event)
		_defaults[action] = events

func rebind_action(action: StringName, new_event: InputEvent) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	
	var current_events = InputMap.action_get_events(action)
	for event in current_events:
		if event is InputEventKey or event is InputEventJoypadButton:
			InputMap.action_erase_event(action, event)
	
	if new_event != null:
		InputMap.action_add_event(action, new_event)
	
	action_rebound.emit(action, new_event)

func get_action_event(action: StringName) -> InputEvent:
	if not InputMap.has_action(action):
		return null
	var events = InputMap.action_get_events(action)
	if events.size() > 0:
		return events[0]
	return null

func save_to_file(path: String = "user://input_map.cfg") -> void:
	var config = ConfigFile.new()
	for action in ACTIONS:
		var event = get_action_event(action)
		if event is InputEventKey:
			config.set_value("bindings", action, {"type": "key", "keycode": event.keycode})
		elif event is InputEventJoypadButton:
			config.set_value("bindings", action, {"type": "joypad_button", "button_index": event.button_index})
		else:
			config.set_value("bindings", action, null)
	config.save(path)

func load_from_file(path: String = "user://input_map.cfg") -> bool:
	var config = ConfigFile.new()
	if config.load(path) != OK:
		return false
	
	for action in ACTIONS:
		if config.has_section_key("bindings", action):
			var data = config.get_value("bindings", action)
			if data == null:
				continue
			if data is Dictionary:
				if data.get("type") == "key":
					var new_event = InputEventKey.new()
					new_event.keycode = data.get("keycode", 0)
					rebind_action(action, new_event)
				elif data.get("type") == "joypad_button":
					var new_event = InputEventJoypadButton.new()
					new_event.button_index = data.get("button_index", 0)
					rebind_action(action, new_event)
	return true

func reset_to_defaults() -> void:
	for action in ACTIONS:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		
		var current_events = InputMap.action_get_events(action)
		for event in current_events:
			if event is InputEventKey or event is InputEventJoypadButton:
				InputMap.action_erase_event(action, event)
		
		if _defaults.has(action):
			for event in _defaults[action]:
				InputMap.action_add_event(action, event)
