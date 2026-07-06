extends Button

@export var action_name: StringName

var _listening: bool = false

func _ready() -> void:
	_refresh_text()
	pressed.connect(_on_pressed)

func _on_pressed() -> void:
	_listening = true
	text = "..."
	release_focus()

func _refresh_text() -> void:
	var ev: InputEvent = InputRemapper.get_action_event(action_name)
	if ev == null:
		text = "<empty>"
	else:
		text = ev.as_text()

func _unhandled_input(event: InputEvent) -> void:
	if not _listening:
		return
	if event is InputEventKey or event is InputEventJoypadButton:
		var captured: InputEvent = event
		_listening = false
		InputRemapper.rebind_action(action_name, captured)
		_refresh_text()
		accept_event()
	elif event is InputEventMouseButton and event.pressed:
		# Allow clicking elsewhere to cancel
		pass
