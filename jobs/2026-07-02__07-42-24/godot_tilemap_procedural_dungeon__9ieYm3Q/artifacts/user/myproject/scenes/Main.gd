extends Node

@onready var tile_map_layer: TileMapLayer = $TileMapLayer
@onready var dungeon_generator: DungeonGenerator = $DungeonGenerator

func _ready():
	print("Main scene ready. Generating dungeon...")
	dungeon_generator.generate(tile_map_layer)
	print("Dungeon generated successfully. Floor tiles: ", dungeon_generator.count_floor_tiles(tile_map_layer))
	
	if DisplayServer.get_name() == "headless":
		print("Headless mode detected, exiting...")
		get_tree().quit()
