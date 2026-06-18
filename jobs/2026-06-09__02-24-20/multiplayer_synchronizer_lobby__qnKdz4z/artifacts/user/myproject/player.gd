extends Node2D

var score: int = 0

func _ready() -> void:
	# Apply position based on authority so MultiplayerSynchronizer propagates it
	if is_multiplayer_authority():
		var peer_id: int = get_multiplayer_authority()
		position = Vector2(float(peer_id), float(peer_id))

@rpc("any_peer", "call_local")
func update_score(value: int) -> void:
	score += value
