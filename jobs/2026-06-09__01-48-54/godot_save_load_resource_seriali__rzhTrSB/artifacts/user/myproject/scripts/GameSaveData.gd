class_name GameSaveData
extends Resource

@export var player_position: Vector2 = Vector2.ZERO
@export var inventory: Array[ItemData] = []
@export var unlocked_levels: PackedStringArray = PackedStringArray()
@export var last_played: int = 0
