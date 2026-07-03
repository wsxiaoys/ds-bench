extends Area2D

# A collectible coin. When the Player walks into it, the Inventory is updated
# and the coin is freed from the scene.

signal collected


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node) -> void:
	if body is Player:
		Inventory.add_coin()
		collected.emit()
		queue_free()