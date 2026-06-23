extends Button

@export var action_name: StringName

var is_listening: bool = false

func _ready() -> void:
	if not InputRemapper.action_rebound.is_connected(_on_action_rebound):
		InputRemapper.action_rebound.connect(_on_action_rebound)
	update_text()

func _pressed() -> void:
	is_listening = true
	text = "Press a key..."
	release_focus()

func _unhandled_input(event: InputEvent) -> void:
	if not is_listening:
		return
	
	if event is InputEventKey or event is InputEventJoypadButton:
		if event.is_pressed():
			if event is InputEventKey and event.is_echo():
				return
			is_listening = false
			get_viewport().set_input_as_handled()
			InputRemapper.rebind_action(action_name, event)

func _on_action_rebound(action: StringName, _event: InputEvent) -> void:
	if action == action_name:
		update_text()

func update_text() -> void:
	var event = InputRemapper.get_action_event(action_name)
	if event != null:
		text = event.as_text()
	else:
		text = "None"
