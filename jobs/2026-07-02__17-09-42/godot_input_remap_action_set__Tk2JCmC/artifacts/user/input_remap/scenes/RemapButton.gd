extends Button
## RemapButton — reusable Control that lets the user rebind a single action.
##
## Drop this scene into any UI, set `action_name` in the inspector and the
## button will display the currently bound event. When pressed, the button
## enters a "listening" state and captures the next keyboard / joypad
## button event via `_unhandled_input`, then asks `InputRemapper` to
## apply the new binding.

@export var action_name: StringName = &""

## When true the button is waiting for the player to press a key / pad
## button. While listening, normal button activation events are ignored.
var _listening: bool = false

func _ready() -> void:
	text = _format_label(action_name)
	if not pressed.is_connected(_on_pressed):
		pressed.connect(_on_pressed)

func _on_pressed() -> void:
	_listening = true
	text = "Press any key..."

func _unhandled_input(event: InputEvent) -> void:
	if not _listening:
		return
	if not (event is InputEventKey or event is InputEventJoypadButton):
		return
	# Ignore purely modifier-style key events without a keycode.
	if event is InputEventKey and event.keycode == 0:
		return
	get_viewport().set_input_as_handled()
	_listening = false
	InputRemapper.rebind_action(action_name, event)
	text = _format_label(action_name)

func _format_label(label_action: StringName) -> String:
	var event: InputEvent = InputRemapper.get_action_event(label_action)
	if event == null or event.as_text() == "":
		return "%s: <unbound>" % label_action
	return "%s: %s" % [label_action, event.as_text()]