extends Node2D


func _ready() -> void:
	var generator = $DungeonGenerator
	var tilemap: TileMapLayer = $TileMapLayer
	generator.generate(tilemap)
