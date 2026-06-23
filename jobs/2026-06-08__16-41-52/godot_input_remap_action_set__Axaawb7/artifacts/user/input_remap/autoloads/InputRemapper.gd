extends Node

## Emitted whenever rebind_action() changes a binding.
signal action_rebound(action: StringName, event: InputEvent)

## Snapshot of the default bindings captured at startup.
var _defaults: Dictionary = {}


func _ready() -> void:
	_snapshot_defaults()


## Store a deep copy of every event bound to every action listed in
## the InputMap so that reset_to_defaults() can restore them.
func _snapshot_defaults() -> void:
	_defaults.clear()
	for action: StringName in InputMap.get_actions():
		var events: Array[InputEvent] = []
		for ev: InputEvent in InputMap.action_get_events(action):
			events.append(ev.duplicate())
		_defaults[action] = events


## Replace all keyboard / joypad-button events currently bound to
## *action* with *new_event*, then emit [signal action_rebound].
func rebind_action(action: StringName, new_event: InputEvent) -> void:
	if not InputMap.has_action(action):
		push_error("InputRemapper: unknown action '%s'" % action)
		return

	# Remove every existing keyboard / joypad-button event.
	var to_remove: Array[InputEvent] = []
	for ev: InputEvent in InputMap.action_get_events(action):
		if ev is InputEventKey or ev is InputEventJoypadButton:
			to_remove.append(ev)
	for ev: InputEvent in to_remove:
		InputMap.action_erase_event(action, ev)

	# Add the new binding.
	InputMap.action_add_event(action, new_event)
	action_rebound.emit(action, new_event)


## Return the first event currently bound to *action* (or null).
func get_action_event(action: StringName) -> InputEvent:
	if not InputMap.has_action(action):
		return null
	var events: Array[InputEvent] = InputMap.action_get_events(action)
	if events.is_empty():
		return null
	return events[0]


## Persist current bindings to *path* (default "user://input_map.cfg").
## Only InputEventKey (physical_keycode) and InputEventJoypadButton (button_index)
## are serialized.
func save_to_file(path: String = "user://input_map.cfg") -> void:
	var cfg := ConfigFile.new()
	for action: StringName in InputMap.get_actions():
		var events: Array[InputEvent] = InputMap.action_get_events(action)
		var serialized: Array = []
		for ev: InputEvent in events:
			if ev is InputEventKey:
				serialized.append({"type": "key", "physical_keycode": ev.physical_keycode})
			elif ev is InputEventJoypadButton:
				serialized.append({"type": "joypad_button", "button_index": ev.button_index})
		if not serialized.is_empty():
			cfg.set_value("actions", action, serialized)
	cfg.save(path)


## Restore bindings from *path* (default "user://input_map.cfg").
## Returns false when the file does not exist, true otherwise.
func load_from_file(path: String = "user://input_map.cfg") -> bool:
	if not FileAccess.file_exists(path):
		return false

	var cfg := ConfigFile.new()
	var err := cfg.load(path)
	if err != OK:
		push_error("InputRemapper: failed to load config from '%s' (error %d)" % [path, err])
		return false

	for action: StringName in InputMap.get_actions():
		if not cfg.has_section_key("actions", action):
			continue

		var data = cfg.get_value("actions", action)

		# Remove existing keyboard / joypad-button events for this action.
		var to_remove: Array[InputEvent] = []
		for ev: InputEvent in InputMap.action_get_events(action):
			if ev is InputEventKey or ev is InputEventJoypadButton:
				to_remove.append(ev)
		for ev: InputEvent in to_remove:
			InputMap.action_erase_event(action, ev)

		# Add events from the config data.
		for entry in data:
			if entry.type == "key":
				var ev := InputEventKey.new()
				ev.physical_keycode = entry.physical_keycode
				ev.keycode = entry.physical_keycode
				InputMap.action_add_event(action, ev)
			elif entry.type == "joypad_button":
				var ev := InputEventJoypadButton.new()
				ev.button_index = entry.button_index
				InputMap.action_add_event(action, ev)

	return true


## Restore every action to the bindings that were present at startup.
func reset_to_defaults() -> void:
	for action: StringName in InputMap.get_actions():
		# Remove all events.
		var to_remove: Array[InputEvent] = []
		for ev: InputEvent in InputMap.action_get_events(action):
			to_remove.append(ev)
		for ev: InputEvent in to_remove:
			InputMap.action_erase_event(action, ev)

		# Add back the defaults.
		if _defaults.has(action):
			for ev: InputEvent in _defaults[action]:
				InputMap.action_add_event(action, ev.duplicate())
