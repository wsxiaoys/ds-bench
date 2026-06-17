extends Node


func _ready() -> void:
	# Quick validation that all required actions exist.
	for action_name: StringName in [&"move_up", &"move_down", &"move_left", &"move_right", &"interact", &"jump"]:
		assert(InputMap.has_action(action_name), "Missing action: %s" % action_name)