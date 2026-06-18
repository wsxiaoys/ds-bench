extends CanvasLayer


func _ready() -> void:
	Inventory.coin_changed.connect(_on_coin_changed)
	_on_coin_changed(Inventory.get_count())


func _on_coin_changed(new_count: int) -> void:
	$CoinLabel.text = "Coins: %d" % new_count
