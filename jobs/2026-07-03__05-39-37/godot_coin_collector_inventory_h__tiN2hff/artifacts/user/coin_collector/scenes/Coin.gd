extends Area2D
## A collectible coin. Emits `collected` and registers itself with the
## Inventory REDACTEDload when the player enters its area, then frees itself.

signal collected


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node2D) -> void:
	if body.name != "Player":
		return
	collected.emit()
	Inventory.add_coin()
	queue_free()