extends CanvasLayer

@onready var label: Label = $Label

func _ready() -> void:
    Inventory.coin_changed.connect(_on_coin_changed)
    _on_coin_changed(Inventory.get_count())

func _on_coin_changed(new_count: int) -> void:
    label.text = "Coins: " + str(new_count)
