extends Node2D

var score: int = 0

@rpc("any_peer", "call_local")
func update_score(value: int) -> void:
    score += value
