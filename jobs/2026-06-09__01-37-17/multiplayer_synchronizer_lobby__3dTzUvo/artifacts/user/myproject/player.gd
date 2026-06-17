extends Node2D

var score: int = 0

func _enter_tree() -> void:
	var peer_id = name.to_int()
	if peer_id > 0:
		set_multiplayer_authority(peer_id)

func _ready() -> void:
	if is_multiplayer_authority():
		position = Vector2(get_multiplayer_authority(), get_multiplayer_authority())

@rpc("any_peer", "call_local")
func update_score(value: int) -> void:
	score += value
