extends Area2D

signal collected

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node2D) -> void:
	if body.name == "Player" or body is CharacterBody2D:
		collected.emit()
		Inventory.add_coin()
		queue_free()
