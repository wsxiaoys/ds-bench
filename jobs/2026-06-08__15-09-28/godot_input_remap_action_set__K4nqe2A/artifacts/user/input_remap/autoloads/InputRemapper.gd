extends Node

## Emitted whenever an action's binding is changed via rebind_action().
signal action_rebound(action: StringName, event: InputEvent)

# Stores the default bindings captured at startup so reset_to_defaults() can
# restore them.  Key: StringName action name → Array[InputEvent].
var _defaults: Dictionary = {}

# The list of actions we manage (must match project.godot [input] section).
const MANAGED_ACTIONS: Array[StringName] = [
	&"move_up",
	&"move_down",
	&"move_left",
	&"move_right",
	&"interact",
	&"jump",
]


func _ready() -> void:
	_capture_defaults()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

## Remove every keyboard / joypad event currently bound to *action* and add
## *new_event* in its place.  Emits action_rebound afterwards.
func rebind_action(action: StringName, new_event: InputEvent) -> void:
	if not InputMap.has_action(action):
		push_error("InputRemapper.rebind_action: unknown action '%s'" % action)
		return

	# Remove existing keyboard and joypad-button events.
	for ev in InputMap.action_get_events(action):
		if ev is InputEventKey or ev is InputEventJoypadButton:
			InputMap.action_erase_event(action, ev)

	InputMap.action_add_event(action, new_event)
	emit_signal("action_rebound", action, new_event)


## Returns the first event currently bound to *action*, or null if none.
func get_action_event(action: StringName) -> InputEvent:
	if not InputMap.has_action(action):
		return null
	var events := InputMap.action_get_events(action)
	if events.is_empty():
		return null
	return events[0]


## Serialise all managed actions to *path* using ConfigFile.
## InputEventKey  → stores keycode (int).
## InputEventJoypadButton → stores button_index (int).
func save_to_file(path: String = "user://input_map.cfg") -> void:
	var cfg := ConfigFile.new()
	for action in MANAGED_ACTIONS:
		if not InputMap.has_action(action):
			continue
		for ev in InputMap.action_get_events(action):
			if ev is InputEventKey:
				cfg.set_value(action, "type", "key")
				cfg.set_value(action, "keycode", ev.keycode)
			elif ev is InputEventJoypadButton:
				cfg.set_value(action, "type", "joypad_button")
				cfg.set_value(action, "button_index", ev.button_index)
	var err := cfg.save(path)
	if err != OK:
		push_error("InputRemapper.save_to_file: failed to save '%s' (err %d)" % [path, err])


## Restore bindings from *path*.  Returns false when the file does not exist.
func load_from_file(path: String = "user://input_map.cfg") -> bool:
	var cfg := ConfigFile.new()
	var err := cfg.load(path)
	if err == ERR_FILE_NOT_FOUND:
		return false
	if err != OK:
		push_error("InputRemapper.load_from_file: failed to load '%s' (err %d)" % [path, err])
		return false

	for action in MANAGED_ACTIONS:
		if not cfg.has_section(action):
			continue
		var type: String = cfg.get_value(action, "type", "")
		var new_event: InputEvent = null
		if type == "key":
			var kc: int = cfg.get_value(action, "keycode", 0)
			var ev := InputEventKey.new()
			ev.keycode = kc as Key
			new_event = ev
		elif type == "joypad_button":
			var bi: int = cfg.get_value(action, "button_index", 0)
			var ev := InputEventJoypadButton.new()
			ev.button_index = bi as JoyButton
			new_event = ev
		if new_event != null:
			rebind_action(action, new_event)
	return true


## Restore every managed action to the bindings captured at _ready().
func reset_to_defaults() -> void:
	for action in MANAGED_ACTIONS:
		if not _defaults.has(action):
			continue
		# Erase all current keyboard / joypad events.
		for ev in InputMap.action_get_events(action):
			if ev is InputEventKey or ev is InputEventJoypadButton:
				InputMap.action_erase_event(action, ev)
		# Re-add the saved defaults.
		for ev in _defaults[action]:
			InputMap.action_add_event(action, ev)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

func _capture_defaults() -> void:
	for action in MANAGED_ACTIONS:
		if InputMap.has_action(action):
			# Store deep copies so later rebinds don't mutate the saved state.
			var copies: Array[InputEvent] = []
			for ev in InputMap.action_get_events(action):
				copies.append(ev.duplicate() as InputEvent)
			_defaults[action] = copies
