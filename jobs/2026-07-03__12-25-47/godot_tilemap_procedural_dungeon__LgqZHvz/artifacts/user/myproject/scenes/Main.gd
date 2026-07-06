extends Node2D

@onready var tile_map: TileMapLayer = $TileMapLayer
@onready var dungeon_generator: Node = $DungeonGenerator

func _ready() -> void:
    if dungeon_generator and tile_map:
        dungeon_generator.generate(tile_map)
