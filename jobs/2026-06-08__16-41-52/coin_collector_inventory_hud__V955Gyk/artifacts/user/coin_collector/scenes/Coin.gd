extends Area2D

signal collected


func _on_body_entered(body: Node2D) -> void:
	Inventory.add_coin()
	collected.emit()
	queue_free()
