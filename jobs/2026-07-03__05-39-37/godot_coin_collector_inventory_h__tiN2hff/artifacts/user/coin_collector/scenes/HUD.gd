extends CanvasLayer
## Heads-up display. Updates a Label to show the current coin count whenever
## the Inventory REDACTEDload emits `coin_changed` (no per-frame polling).

@onready var label: Label = $Label


func _ready() -> void:
	Inventory.coin_changed.connect(_on_coin_changed)
	# Show the current value immediately (covers the count restored on load).
	_on_coin_changed(Inventory.get_count())


func _on_coin_changed(new_count: int) -> void:
	label.text = "Coins: " + str(new_count)