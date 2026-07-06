extends Node2D

# Replicated integer score field. Initial value is 0.
var score: int = 0


@rpc("any_peer", "call_local")
func update_score(value: int) -> void:
	score += value