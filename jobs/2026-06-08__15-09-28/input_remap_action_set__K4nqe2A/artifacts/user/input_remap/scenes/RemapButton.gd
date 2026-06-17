extends Control

## The InputMap action this button is responsible for rebinding.
@export var action_name: StringName = &""

# Whether this button is currently waiting for the next input event.
var _listening: bool = false

# Reference to the inner Button node.
@onready var _button: Button = $Button


func _ready() -> void:
	if not _button.pressed.is_connected(_on_button_pressed):
		_button.pressed.connect(_on_button_pressed)
	_refresh_label()
	# Keep up-to-date when another button (or code) rebinds the same action.
	if not InputRemapper.action_rebound.is_connected(_on_action_rebound):
		InputRemapper.action_rebound.connect(_on_action_rebound)


# ---------------------------------------------------------------------------
# Input capture
# ---------------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if not _listening:
		return
	if not (event is InputEventKey or event is InputEventJoypadButton):
		return
	# Eat the event so nothing else reacts to it (viewport may be null in tests).
	var vp := get_viewport()
	if vp != null:
		vp.set_input_as_handled()
	_listening = false
	InputRemapper.rebind_action(action_name, event)
	_refresh_label()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

func _refresh_label() -> void:
	if action_name == &"":
		_button.text = "(no action)"
		return
	var ev := InputRemapper.get_action_event(action_name)
	if ev == null:
		_button.text = "(unbound)"
	else:
		_button.text = ev.as_text()


func _on_button_pressed() -> void:
	_listening = true
	_button.text = "Press a key…"


func _on_action_rebound(action: StringName, _event: InputEvent) -> void:
	if action == action_name:
		_refresh_label()
