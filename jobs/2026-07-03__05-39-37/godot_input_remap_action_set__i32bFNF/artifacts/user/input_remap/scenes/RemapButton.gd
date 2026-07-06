@tool
class_name RemapButton
extends Button
## A [Button] that displays the current binding for an input action and lets the
## user rebind it by listening for the next key/joypad press.
##
## Designed to be used as the root of [code]scenes/RemapButton.tscn[/code].

## The InputMap action this button controls.
@export var action_name: StringName

## When [code]true[/code] the button is waiting for the next input event to use
## as the new binding.
var _listening: bool = false


func _ready() -> void:
	_refresh_label()
	pressed.connect(_on_pressed)
	# Keep the label in sync while editing in the editor.
	if Engine.is_editor_hint():
		set_process(true)


func _process(_delta: float) -> void:
	if Engine.is_editor_hint():
		_refresh_label()


func _on_pressed() -> void:
	_listening = true
	text = "Press a key..."


func _unhandled_input(event: InputEvent) -> void:
	if not _listening:
		return

	# Only react to a physical key press, not the release.
	if event is InputEventKey:
		var key: InputEventKey = event
		if not key.pressed or key.echo:
			return
		# Ignore pure modifier presses so the user can combine them with a real key.
		# If the key itself is a modifier, still accept it as a binding.
		_accept_event(key)
		get_viewport().set_input_as_handled()
	elif event is InputEventJoypadButton:
		var joy: InputEventJoypadButton = event
		if not joy.pressed:
			return
		_accept_event(joy)
		get_viewport().set_input_as_handled()


func _accept_event(event: InputEvent) -> void:
	_listening = false
	InputRemapper.rebind_action(action_name, event)
	_refresh_label()


## Update the button text to reflect the currently bound event.
func _refresh_label() -> void:
	if action_name == null or action_name.is_empty():
		text = "(no action)"
		return
	if not InputMap.has_action(action_name):
		text = "(unknown: %s)" % action_name
		return
	var event: InputEvent = InputRemapper.get_action_event(action_name)
	if event == null:
		text = "(unbound)"
	else:
		text = event.as_text()