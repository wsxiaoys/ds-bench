extends Node
## Singleton REDACTEDload that rebinds, saves, loads and resets the InputMap at runtime.
##
## Registered in project.godot as `InputRemapper`.

signal action_rebound(action: StringName, event: InputEvent)

## Snapshot of the default actions captured at startup.
## Maps action name -> Array of InputEvent.
var _defaults: Dictionary = {}


func _ready() -> void:
	_capture_defaults()


## Record the current bindings for every action declared in the InputMap so they
## can be restored later by [method reset_to_defaults].
func _capture_defaults() -> void:
	_defaults.clear()
	for action: StringName in InputMap.get_actions():
		# Skip Godot's built-in UI actions so we only snapshot project actions.
		if action.begins_with("ui_"):
			continue
		var events: Array[InputEvent] = []
		for event: InputEvent in InputMap.action_get_events(action):
			events.append(_duplicate_event(event))
		_defaults[action] = events


## Remove all keyboard/joypad events currently bound to [param action] and bind
## [param new_event] in their place.
func rebind_action(action: StringName, new_event: InputEvent) -> void:
	if not InputMap.has_action(action):
		push_error("InputRemapper: action '%s' does not exist in the InputMap." % action)
		return

	for event: InputEvent in InputMap.action_get_events(action):
		if event is InputEventKey or event is InputEventJoypadButton:
			InputMap.action_erase_event(action, event)

	InputMap.action_add_event(action, new_event)
	action_rebound.emit(action, new_event)


## Return the first event currently bound to [param action], or [code]null[/code].
func get_action_event(action: StringName) -> InputEvent:
	if not InputMap.has_action(action):
		push_error("InputRemapper: action '%s' does not exist in the InputMap." % action)
		return null
	var events: Array[InputEvent] = InputMap.action_get_events(action)
	if events.is_empty():
		return null
	return events[0]


## Serialize the current bindings to a [param path] using a [ConfigFile].
##
## [InputEventKey] events are stored by [member InputEventKey.keycode] and
## [InputEventJoypadButton] events by [member InputEventJoypadButton.button_index].
func save_to_file(path: String = "user://input_map.cfg") -> void:
	var config := ConfigFile.new()
	for action: StringName in InputMap.get_actions():
		if action.begins_with("ui_"):
			continue
		var events: Array[InputEvent] = InputMap.action_get_events(action)
		var index := 0
		for event: InputEvent in events:
			if event is InputEventKey:
				var key: InputEventKey = event
				config.set_value(action, "keycode_%d" % index, key.keycode)
				config.set_value(action, "physical_keycode_%d" % index, key.physical_keycode)
				config.set_value(action, "unicode_%d" % index, key.unicode)
				config.set_value(action, "type_%d" % index, "key")
			elif event is InputEventJoypadButton:
				var joy: InputEventJoypadButton = event
				config.set_value(action, "button_index_%d" % index, joy.button_index)
				config.set_value(action, "type_%d" % index, "joypad")
			index += 1
		config.set_value(action, "count", index)

	var err: int = config.save(path)
	if err != OK:
		push_error("InputRemapper: failed to save input map to '%s' (error %d)." % [path, err])


## Restore bindings previously written by [method save_to_file].
## Returns [code]false[/code] when the file does not exist, [code]true[/code] otherwise.
func load_from_file(path: String = "user://input_map.cfg") -> bool:
	if not FileAccess.file_exists(path):
		return false

	var config := ConfigFile.new()
	var err: int = config.load(path)
	if err != OK:
		push_error("InputRemapper: failed to load input map from '%s' (error %d)." % [path, err])
		return false

	for action: StringName in InputMap.get_actions():
		if action.begins_with("ui_"):
			continue
		if not config.has_section(action):
			continue

		# Wipe existing keyboard/joypad events before restoring.
		for event: InputEvent in InputMap.action_get_events(action):
			if event is InputEventKey or event is InputEventJoypadButton:
				InputMap.action_erase_event(action, event)

		var count: int = int(config.get_value(action, "count", 0))
		for index: int in count:
			var type: String = String(config.get_value(action, "type_%d" % index, ""))
			if type == "key":
				var key := InputEventKey.new()
				key.keycode = int(config.get_value(action, "keycode_%d" % index, 0))
				key.physical_keycode = int(config.get_value(action, "physical_keycode_%d" % index, 0))
				key.unicode = int(config.get_value(action, "unicode_%d" % index, 0))
				InputMap.action_add_event(action, key)
			elif type == "joypad":
				var joy := InputEventJoypadButton.new()
				joy.button_index = int(config.get_value(action, "button_index_%d" % index, 0))
				InputMap.action_add_event(action, joy)

	return true


## Restore the bindings captured at startup.
func reset_to_defaults() -> void:
	for action: StringName in _defaults:
		if not InputMap.has_action(action):
			continue
		# Remove all current events.
		for event: InputEvent in InputMap.action_get_events(action):
			InputMap.action_erase_event(action, event)
		# Re-add the captured defaults.
		for event: InputEvent in _defaults[action]:
			InputMap.action_add_event(action, _duplicate_event(event))


## Return a deep copy of [param event] so stored defaults are not aliased.
func _duplicate_event(event: InputEvent) -> InputEvent:
	if event is InputEventKey:
		var copy := InputEventKey.new()
		var src: InputEventKey = event
		copy.keycode = src.keycode
		copy.physical_keycode = src.physical_keycode
		copy.key_label = src.key_label
		copy.unicode = src.unicode
		copy.location = src.location
		copy.echo = src.echo
		copy.device = src.device
		copy.alt_pressed = src.alt_pressed
		copy.shift_pressed = src.shift_pressed
		copy.ctrl_pressed = src.ctrl_pressed
		copy.meta_pressed = src.meta_pressed
		return copy
	elif event is InputEventJoypadButton:
		var copy := InputEventJoypadButton.new()
		var src: InputEventJoypadButton = event
		copy.button_index = src.button_index
		copy.device = src.device
		copy.pressed = src.pressed
		return copy
	return event.duplicate(true)