extends Node2D

func _ready():
	var generator = $DungeonGenerator
	var tilemap = $TileMapLayer
	generator.generate(tilemap)
