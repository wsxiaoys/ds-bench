extends Node

signal action_rebound(action: StringName, event: InputEvent)

var _default_bindings: Dictionary = {}

func _ready() -> void:
	# Capture default bindings at startup
	for action in InputMap.get_actions():
		_default_bindings[action] = []
		for event in InputMap.action_get_events(action):
			_default_bindings[action].append(event.duplicate())

func rebind_action(action: StringName, new_event: InputEvent) -> void:
	if not InputMap.has_action(action):
		return
	
	var events = InputMap.action_get_events(action)
	for event in events:
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
	for action in InputMap.get_actions():
		var serialized_events = []
		for event in InputMap.action_get_events(action):
			if event is InputEventKey:
				serialized_events.append({
					"type": "key",
					"keycode": event.keycode
				})
			elif event is InputEventJoypadButton:
				serialized_events.append({
					"type": "joy_button",
					"button_index": event.button_index
				})
		config.set_value("bindings", action, serialized_events)
	config.save(path)

func load_from_file(path: String = "user://input_map.cfg") -> bool:
	var config = ConfigFile.new()
	var err = config.load(path)
	if err != OK:
		return false
	
	if not config.has_section("bindings"):
		return true
	
	var actions = config.get_section_keys("bindings")
	for action in actions:
		if not InputMap.has_action(action):
			continue
		
		# Clear existing keyboard/joypad events
		var current_events = InputMap.action_get_events(action)
		for event in current_events:
			if event is InputEventKey or event is InputEventJoypadButton:
				InputMap.action_erase_event(action, event)
		
		# Restore loaded events
		var serialized_events = config.get_value("bindings", action, [])
		for ser in serialized_events:
			if not ser is Dictionary:
				continue
			if ser.get("type") == "key":
				var key_event = InputEventKey.new()
				key_event.keycode = ser.get("keycode", 0) as Key
				InputMap.action_add_event(action, key_event)
			elif ser.get("type") == "joy_button":
				var joy_event = InputEventJoypadButton.new()
				joy_event.button_index = ser.get("button_index", 0) as JoyButton
				InputMap.action_add_event(action, joy_event)
	return true

func reset_to_defaults() -> void:
	for action in _default_bindings.keys():
		if not InputMap.has_action(action):
			continue
		
		# Clear existing keyboard/joypad events
		var current_events = InputMap.action_get_events(action)
		for event in current_events:
			if event is InputEventKey or event is InputEventJoypadButton:
				InputMap.action_erase_event(action, event)
		
		# Restore default keyboard/joypad events
		for event in _default_bindings[action]:
			if event is InputEventKey or event is InputEventJoypadButton:
				InputMap.action_add_event(action, event.duplicate())
