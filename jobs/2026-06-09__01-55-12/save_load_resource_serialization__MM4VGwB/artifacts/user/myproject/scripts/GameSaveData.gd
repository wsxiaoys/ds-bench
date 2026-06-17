## GameSaveData.gd
## A custom Resource that bundles all persistent player state.
## Nested ItemData entries are serialized as inline sub-resources.
class_name GameSaveData
extends Resource

## World-space position of the player at the moment of saving.
@export var player_position: Vector2 = Vector2.ZERO

## All items currently in the player's inventory.
## Each element is an ItemData sub-resource.
@export var inventory: Array[ItemData] = []

## Identifiers of every level the player has completed or unlocked.
@export var unlocked_levels: PackedStringArray = PackedStringArray()

## Unix timestamp (seconds since epoch) of when this save was written.
@export var last_played: int = 0


func _init(
	p_position: Vector2 = Vector2.ZERO,
	p_inventory: Array[ItemData] = [],
	p_unlocked: PackedStringArray = PackedStringArray(),
	p_last_played: int = 0
) -> void:
	player_position = p_position
	inventory = p_inventory
	unlocked_levels = p_unlocked
	last_played = p_last_played
