class_name GameSaveData
extends Resource

## Top-level save-game payload.
##
## Holds the player state plus a list of [ItemData] sub-resources
## (the inventory).  Because the inventory is typed
## [code]Array[ItemData][/code] and [ItemData] has its own
## [code]class_name[/code], [ResourceSaver] serialises the items as
## inline sub-resources of the parent [GameSaveData] in both
## [code].tres[/code] (text) and [code].res[/code] (binary) form.

@export var player_position: Vector2 = Vector2.ZERO
@export var inventory: Array[ItemData] = []
@export var unlocked_levels: PackedStringArray = PackedStringArray()
@export var last_played: int = 0
