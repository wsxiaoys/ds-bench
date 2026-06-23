extends Button

@export var action_name: StringName = &"":
	set(value):
		action_name = value
		if is_node_ready():
			_update_label()

var _listening := false


func _ready() -> void:
	_update_label()
	InputRemapper.action_rebound.connect(_on_action_rebound)
	pressed.connect(_on_pressed)


func _update_label() -> void:
	if action_name == &"":
		text = "Unassigned"
		return
	var events: Array = InputMap.action_get_events(action_name)
	if events.size() == 0:
		text = "Unassigned"
	else:
		text = events[0].as_text()


func _on_pressed() -> void:
	_listening = true
	text = "Listening..."


func _unhandled_input(event: InputEvent) -> void:
	if not _listening:
		return
	if event is InputEventKey:
		if not event.pressed:
			return
		_listening = false
		InputRemapper.rebind_action(action_name, event)
		_update_label()
		get_viewport().set_input_as_handled()
	elif event is InputEventJoypadButton:
		if not event.pressed:
			return
		_listening = false
		InputRemapper.rebind_action(action_name, event)
		_update_label()
		get_viewport().set_input_as_handled()


func _on_action_rebound(action: StringName, _event: InputEvent) -> void:
	if action == action_name:
		_update_label()