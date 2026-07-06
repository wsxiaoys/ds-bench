extends Area2D

signal collected

func _on_body_entered(body: Node) -> void:
	if body.name == "Player":
		Inventory.add_coin()
		collected.emit()
		queue_free()
