extends Area2D

signal collected


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node2D) -> void:
	if body is CharacterBody2D:
		emit_signal("collected")
		Inventory.add_coin()
		queue_free()
