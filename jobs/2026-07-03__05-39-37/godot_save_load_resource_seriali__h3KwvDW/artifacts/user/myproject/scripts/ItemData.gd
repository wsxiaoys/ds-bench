class_name ItemData
extends Resource

## A single inventory entry serialized as a nested sub-resource of GameSaveData.

@export var id: String = ""
@export var quantity: int = 0
@export var rarity: int = 0


func _to_string() -> String:
	return "ItemData(id=%s, quantity=%d, rarity=%d)" % [id, quantity, rarity]