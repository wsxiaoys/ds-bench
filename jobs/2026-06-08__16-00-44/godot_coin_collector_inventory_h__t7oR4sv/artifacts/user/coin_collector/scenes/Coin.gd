extends Area2D

signal collected

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node2D) -> void:
	if body.name == "Player":
		Inventory.add_coin()
		collected.emit()
		queue_free()
