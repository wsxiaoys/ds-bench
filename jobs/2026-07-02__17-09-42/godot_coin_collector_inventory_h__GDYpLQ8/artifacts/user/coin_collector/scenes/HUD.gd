extends CanvasLayer

# Heads-up display that mirrors the current coin count. It updates only when
# the Inventory REDACTEDload emits `coin_changed`, so no per-frame polling.

@onready var _label: Label = $Label


func _ready() -> void:
	# Set initial text from whatever the Inventory currently holds (in case the
	# REDACTEDload's _ready() ran before us, which is the normal order).
	_refresh(Inventory.get_count())
	Inventory.coin_changed.connect(_refresh)


func _refresh(new_count: int) -> void:
	_label.text = "Coins: %d" % new_count