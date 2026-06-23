extends CanvasLayer

@onready var coin_label: Label = $Label

func _ready() -> void:
	_update_label(Inventory.get_count())
	Inventory.coin_changed.connect(_update_label)

func _update_label(new_count: int) -> void:
	coin_label.text = "Coins: " + str(new_count)
