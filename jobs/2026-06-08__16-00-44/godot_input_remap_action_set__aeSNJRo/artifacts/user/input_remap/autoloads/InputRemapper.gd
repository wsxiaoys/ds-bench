extends Node

signal action_rebound(action: StringName, event: InputEvent)

# Stored default bindings captured at startup.
# Maps StringName -> Array of InputEvent
var _defaults: Dictionary = {}


func _ready() -> void:
	# Capture the default bindings for all registered actions.
	for action in InputMap.get_actions():
		_defaults[action] = InputMap.action_get_events(action)


## Rebind an action: removes all existing keyboard/joypad events and adds new_event.
func rebind_action(action: StringName, new_event: InputEvent) -> void:
	var old_events: Array = InputMap.action_get_events(action)
	# Remove all keyboard and joypad button events, keep others.
	var filtered: Array = []
	for ev in old_events:
		if ev is InputEventKey or ev is InputEventJoypadButton:
			continue
		filtered.append(ev)
	InputMap.action_erase_events(action)
	for ev in filtered:
		InputMap.action_add_event(action, ev)
	InputMap.action_add_event(action, new_event)
	action_rebound.emit(action, new_event)


## Returns the first event currently bound to the given action.
func get_action_event(action: StringName) -> InputEvent:
	var events: Array = InputMap.action_get_events(action)
	if events.size() > 0:
		return events[0]
	return null


## Save current bindings to a ConfigFile at the given path.
## Serializes InputEventKey by keycode and InputEventJoypadButton by button_index.
func save_to_file(path: String = "user://input_map.cfg") -> void:
	var config := ConfigFile.new()
	for action in InputMap.get_actions():
		var events: Array = InputMap.action_get_events(action)
		var idx := 0
		for ev in events:
			if ev is InputEventKey:
				config.set_value(action, "event_%d_type" % idx, "InputEventKey")
				config.set_value(action, "event_%d_keycode" % idx, ev.keycode)
				config.set_value(action, "event_%d_physical_keycode" % idx, ev.physical_keycode)
				config.set_value(action, "event_%d_key_label" % idx, ev.key_label)
				config.set_value(action, "event_%d_unicode" % idx, ev.unicode)
				config.set_value(action, "event_%d_location" % idx, ev.location)
				config.set_value(action, "event_%d_alt" % idx, ev.alt_pressed)
				config.set_value(action, "event_%d_shift" % idx, ev.shift_pressed)
				config.set_value(action, "event_%d_ctrl" % idx, ev.ctrl_pressed)
				config.set_value(action, "event_%d_meta" % idx, ev.meta_pressed)
			elif ev is InputEventJoypadButton:
				config.set_value(action, "event_%d_type" % idx, "InputEventJoypadButton")
				config.set_value(action, "event_%d_button_index" % idx, ev.button_index)
			else:
				config.set_value(action, "event_%d_type" % idx, "Unknown")
			idx += 1
		config.set_value(action, "event_count", idx)
	config.save(path)


## Load bindings from a ConfigFile. Returns false if the file doesn't exist, true otherwise.
func load_from_file(path: String = "user://input_map.cfg") -> bool:
	if not FileAccess.file_exists(path):
		return false

	var config := ConfigFile.new()
	if config.load(path) != OK:
		return false

	for action in config.get_sections():
		if not InputMap.has_action(action):
			continue
		var count: int = config.get_value(action, "event_count", 0)
		InputMap.action_erase_events(action)
		for idx in range(count):
			var event_type: String = config.get_value(action, "event_%d_type" % idx, "Unknown")
			if event_type == "InputEventKey":
				var ev := InputEventKey.new()
				ev.keycode = config.get_value(action, "event_%d_keycode" % idx, 0) as Key
				ev.physical_keycode = config.get_value(action, "event_%d_physical_keycode" % idx, 0) as int
				ev.key_label = config.get_value(action, "event_%d_key_label" % idx, 0) as int
				ev.unicode = config.get_value(action, "event_%d_unicode" % idx, 0) as int
				ev.location = config.get_value(action, "event_%d_location" % idx, 0) as int
				ev.alt_pressed = config.get_value(action, "event_%d_alt" % idx, false)
				ev.shift_pressed = config.get_value(action, "event_%d_shift" % idx, false)
				ev.ctrl_pressed = config.get_value(action, "event_%d_ctrl" % idx, false)
				ev.meta_pressed = config.get_value(action, "event_%d_meta" % idx, false)
				InputMap.action_add_event(action, ev)
			elif event_type == "InputEventJoypadButton":
				var ev := InputEventJoypadButton.new()
				ev.button_index = config.get_value(action, "event_%d_button_index" % idx, 0) as JoyButton
				InputMap.action_add_event(action, ev)
	return true


## Restore all actions to the bindings captured at startup.
func reset_to_defaults() -> void:
	for action in _defaults:
		InputMap.action_erase_events(action)
		for ev in _defaults[action]:
			InputMap.action_add_event(action, ev)