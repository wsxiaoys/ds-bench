extends Button

@export var action_name: StringName

var _is_listening: bool = false

func _ready() -> void:
	if not InputRemapper.action_rebound.is_connected(_on_action_rebound):
		InputRemapper.action_rebound.connect(_on_action_rebound)
	_update_text()

func _pressed() -> void:
	_is_listening = true
	release_focus()
	text = "Press any key/button..."

func _unhandled_input(event: InputEvent) -> void:
	if not _is_listening:
		return
	
	if event is InputEventKey or event is InputEventJoypadButton:
		if event.is_pressed() and not event.is_echo():
			_is_listening = false
			get_viewport().set_input_as_handled()
			InputRemapper.rebind_action(action_name, event)

func _on_action_rebound(action: StringName, _event: InputEvent) -> void:
	if action == action_name:
		_update_text()

func _update_text() -> void:
	var event = InputRemapper.get_action_event(action_name)
	if event != null:
		text = event.as_text()
	else:
		text = "Unbound"
