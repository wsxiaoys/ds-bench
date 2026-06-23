extends Node

signal action_rebound(action: StringName, event: InputEvent)

var _default_bindings: Dictionary = {}

func _ready() -> void:
    # Capture default bindings at startup
    for action in InputMap.get_actions():
        var events = InputMap.action_get_events(action)
        var default_events = []
        for event in events:
            if event is InputEventKey or event is InputEventJoypadButton:
                default_events.append(event)
        if default_events.size() > 0:
            _default_bindings[action] = default_events[0]

func rebind_action(action: StringName, new_event: InputEvent) -> void:
    if not InputMap.has_action(action):
        return
    
    # Remove existing keyboard/joypad events
    var events = InputMap.action_get_events(action)
    for event in events:
        if event is InputEventKey or event is InputEventJoypadButton:
            InputMap.action_erase_event(action, event)
    
    # Add new event
    InputMap.action_add_event(action, new_event)
    action_rebound.emit(action, new_event)

func get_action_event(action: StringName) -> InputEvent:
    if not InputMap.has_action(action):
        return null
    var events = InputMap.action_get_events(action)
    if events.is_empty():
        return null
    return events[0]

func save_to_file(path: String = "user://input_map.cfg") -> void:
    var config = ConfigFile.new()
    for action in InputMap.get_actions():
        var events = InputMap.action_get_events(action)
        for event in events:
            if event is InputEventKey:
                config.set_value("input", action, {"type": "key", "keycode": event.keycode})
                break
            elif event is InputEventJoypadButton:
                config.set_value("input", action, {"type": "joypad", "button_index": event.button_index})
                break
    config.save(path)

func load_from_file(path: String = "user://input_map.cfg") -> bool:
    var config = ConfigFile.new()
    var err = config.load(path)
    if err != OK:
        return false
    
    if not config.has_section("input"):
        return true
        
    for action in config.get_section_keys("input"):
        if InputMap.has_action(action):
            var data = config.get_value("input", action)
            var new_event: InputEvent = null
            
            if typeof(data) == TYPE_DICTIONARY:
                if data.get("type") == "key":
                    new_event = InputEventKey.new()
                    new_event.keycode = data.get("keycode", 0)
                elif data.get("type") == "joypad":
                    new_event = InputEventJoypadButton.new()
                    new_event.button_index = data.get("button_index", 0)
            
            if new_event != null:
                rebind_action(action, new_event)
                
    return true

func reset_to_defaults() -> void:
    for action in _default_bindings.keys():
        if InputMap.has_action(action):
            rebind_action(action, _default_bindings[action])
