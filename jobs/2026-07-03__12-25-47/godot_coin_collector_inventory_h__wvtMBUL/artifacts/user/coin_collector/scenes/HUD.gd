extends CanvasLayer

@onready var label: Label = $Label

func _ready() -> void:
	label.text = "Coins: %d" % Inventory.get_count()
	Inventory.coin_changed.connect(_on_coin_changed)

func _on_coin_changed(new_count: int) -> void:
	label.text = "Coins: %d" % new_count
