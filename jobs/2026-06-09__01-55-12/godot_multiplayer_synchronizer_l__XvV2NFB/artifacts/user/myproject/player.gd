extends Node2D

## Per-player score, authoritative on the owning peer.
var score: int = 0

func _enter_tree() -> void:
	# The node's name is set to the owning peer's ID (as a string) before it
	# enters the tree, both on the server (explicitly) and on clients (via the
	# spawn packet).  Setting multiplayer authority here — during _enter_tree —
	# ensures the MultiplayerSynchronizer registers with the correct authority
	# and avoids the "no network ID" error that occurs when authority is changed
	# in _ready or after add_child().
	var peer_id_str: String = String(name)
	if peer_id_str.is_valid_int():
		set_multiplayer_authority(int(peer_id_str))

@rpc("any_peer", "call_local")
func update_score(value: int) -> void:
	score += value
