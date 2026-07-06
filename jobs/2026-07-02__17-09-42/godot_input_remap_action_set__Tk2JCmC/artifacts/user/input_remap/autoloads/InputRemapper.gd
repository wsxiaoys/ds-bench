extends Node
## InputRemapper singleton.
##
## Captures the baseline action bindings defined in `project.godot` at
## startup and exposes runtime rebind / save / load / reset helpers.

signal action_rebound(action: StringName, event: InputEvent)

## Mapping of action name -> Array of InputEvents captured at startup.
var _defaults: Dictionary = {}

func _ready() -> void:
	_capture_defaults()

## Snapshot the current InputMap so we can restore defaults at runtime.
func _capture_defaults() -> void:
	_defaults.clear()
	for action in InputMap.get_actions():
		var events: Array = []
		for event in InputMap.action_get_events(action):
			events.append(event)
		_defaults[action] = events

## Removes existing keyboard / joypad events from `action` and adds
## `new_event`. Emits `action_rebound` on success.
func rebind_action(action: StringName, new_event: InputEvent) -> void:
	if not InputMap.has_action(action):
		push_warning("InputRemapper: unknown action '%s'" % action)
		return
	# Strip existing keyboard / joypad bindings for this action.
	for event in InputMap.action_get_events(action):
		if event is InputEventKey or event is InputEventJoypadButton:
			InputMap.action_erase_event(action, event)
	InputMap.action_add_event(action, new_event)
	action_rebound.emit(action, new_event)

## Returns the first event currently bound to `action`, or `null`
## when no event exists.
func get_action_event(action: StringName) -> InputEvent:
	if not InputMap.has_action(action):
		return null
	var events := InputMap.action_get_events(action)
	if events.is_empty():
		return null
	return events[0]

## Writes current bindings to `path` using `ConfigFile`.
## `InputEventKey` is serialized by `keycode`,
## `InputEventJoypadButton` is serialized by `button_index`.
func save_to_file(path: String = "user://input_map.cfg") -> void:
	var cfg := ConfigFile.new()
	for action in InputMap.get_actions():
		var key_value: int = -1
		var button_value: int = -1
		for event in InputMap.action_get_events(action):
			if event is InputEventKey:
				key_value = event.keycode
			elif event is InputEventJoypadButton:
				button_value = event.button_index
		cfg.set_value(action, "keycode", key_value)
		cfg.set_value(action, "button_index", button_value)
	var err := cfg.save(path)
	if err != OK:
		push_error("InputRemapper: failed to save input map to '%s' (err=%d)" % [path, err])

## Loads bindings from `path`. Returns `false` if the file does not
## exist; otherwise restores the bindings and returns `true`.
func load_from_file(path: String = "user://input_map.cfg") -> bool:
	if not FileAccess.file_exists(path):
		return false
	var cfg := ConfigFile.new()
	var err := cfg.load(path)
	if err != OK:
		push_error("InputRemapper: failed to load input map from '%s' (err=%d)" % [path, err])
		return false
	for action in InputMap.get_actions():
		var key_value: int = int(cfg.get_value(action, "keycode", -1))
		var button_value: int = int(cfg.get_value(action, "button_index", -1))
		# Strip existing keyboard / joypad events before restoring.
		for event in InputMap.action_get_events(action):
			if event is InputEventKey or event is InputEventJoypadButton:
				InputMap.action_erase_event(action, event)
		if key_value >= 0:
			var key_event := InputEventKey.new()
			key_event.keycode = key_value
			InputMap.action_add_event(action, key_event)
		if button_value >= 0:
			var button_event := InputEventJoypadButton.new()
			button_event.button_index = button_value
			InputMap.action_add_event(action, button_event)
	return true

## Restores the bindings captured at startup.
func reset_to_defaults() -> void:
	for action in InputMap.get_actions():
		# Strip existing keyboard / joypad events before restoring.
		for event in InputMap.action_get_events(action):
			if event is InputEventKey or event is InputEventJoypadButton:
				InputMap.action_erase_event(action, event)
		if not _defaults.has(action):
			continue
		for event in _defaults[action]:
			InputMap.action_add_event(action, event)