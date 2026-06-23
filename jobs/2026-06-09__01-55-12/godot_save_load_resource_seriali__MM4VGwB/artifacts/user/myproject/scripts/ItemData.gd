## ItemData.gd
## A custom Resource describing a single inventory entry.
## Serialized as an inline sub-resource inside GameSaveData files.
class_name ItemData
extends Resource

## Unique identifier for the item type (e.g. "sword_iron", "potion_health").
@export var id: String = ""

## How many of this item the player carries.
@export var quantity: int = 0

## Rarity tier (0 = common, 1 = uncommon, 2 = rare, 3 = epic, 4 = legendary).
@export var rarity: int = 0


func _init(p_id: String = "", p_quantity: int = 0, p_rarity: int = 0) -> void:
	id = p_id
	quantity = p_quantity
	rarity = p_rarity
