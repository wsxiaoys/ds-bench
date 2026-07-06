class_name GameSaveData
extends Resource

## Top-level save resource. The ``inventory`` array holds nested ``ItemData``
## sub-resources which are serialized inline by the engine because ``ItemData``
## declares its own ``class_name``.

@export var player_position: Vector2 = Vector2.ZERO
@export var inventory: Array[ItemData] = []
@export var unlocked_levels: PackedStringArray = PackedStringArray()
@export var last_played: int = 0


func _to_string() -> String:
	return "GameSaveData(player_position=%s, inventory=%s, unlocked_levels=%s, last_played=%d)" % [
		player_position, inventory, unlocked_levels, last_played
	]