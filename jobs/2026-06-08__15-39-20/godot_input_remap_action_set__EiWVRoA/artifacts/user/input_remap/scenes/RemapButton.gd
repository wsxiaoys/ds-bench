extends Button

@export var action_name: StringName

var _is_listening: bool = false

func _ready() -> void:
    if action_name != &"":
        _update_text()
        InputRemapper.action_rebound.connect(_on_action_rebound)
    pressed.connect(_on_pressed)

func _update_text() -> void:
    var event = InputRemapper.get_action_event(action_name)
    if event:
        text = event.as_text()
    else:
        text = "Unassigned"

func _on_action_rebound(action: StringName, event: InputEvent) -> void:
    if action == action_name:
        _update_text()

func _on_pressed() -> void:
    _is_listening = true
    text = "Listening..."

func _unhandled_input(event: InputEvent) -> void:
    if not _is_listening:
        return
    
    if (event is InputEventKey or event is InputEventJoypadButton) and event.is_pressed():
        if event is InputEventKey and event.is_echo():
            return
        get_viewport().set_input_as_handled()
        _is_listening = false
        InputRemapper.rebind_action(action_name, event)
