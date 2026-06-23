extends Node2D
class_name Player

@export var score: int = 0

func _enter_tree():
	set_multiplayer_authority(name.to_int())

func _ready():
	if is_multiplayer_authority():
		position = Vector2(name.to_int(), name.to_int())

@rpc("any_peer", "call_local")
func update_score(value: int) -> void:
	score += value
