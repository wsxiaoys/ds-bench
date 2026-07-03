extends Node2D
## Root scene script.  Looks up the TileMapLayer + DungeonGenerator children
## and triggers generate() in _ready().

@onready var _tile_map_layer: TileMapLayer = $TileMapLayer
@onready var _dungeon_generator: DungeonGenerator = $DungeonGenerator

func _ready() -> void:
	if _tile_map_layer == null:
		push_error("Main: missing TileMapLayer child")
		return
	if _dungeon_generator == null:
		push_error("Main: missing DungeonGenerator child")
		return
	_dungeon_generator.generate(_tile_map_layer)