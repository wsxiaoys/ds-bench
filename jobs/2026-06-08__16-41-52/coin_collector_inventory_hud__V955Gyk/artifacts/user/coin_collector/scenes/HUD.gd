extends CanvasLayer


func _ready() -> void:
	_update_label(Inventory.get_count())
	Inventory.coin_changed.connect(_on_coin_changed)


func _on_coin_changed(new_count: int) -> void:
	_update_label(new_count)


func _update_label(count: int) -> void:
	$Label.text = "Coins: %d" % count
