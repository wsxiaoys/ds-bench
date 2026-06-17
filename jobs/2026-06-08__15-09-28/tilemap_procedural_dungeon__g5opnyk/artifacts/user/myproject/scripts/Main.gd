## Main.gd – root script for the Main scene.
## Retrieves the DungeonGenerator child and calls generate() on _ready.
extends Node2D

func _ready() -> void:
	var generator: Node = $DungeonGenerator
	var tile_map: TileMapLayer = $TileMapLayer
	generator.call("generate", tile_map)
