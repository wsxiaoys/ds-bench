extends Node

func _ready():
	print("Main _ready called, generating dungeon...")
	$DungeonGenerator.generate($TileMapLayer)
	var floor_count = $DungeonGenerator.count_floor_tiles($TileMapLayer)
	print("Dungeon generated. Floor tiles: ", floor_count)
	var rooms = $DungeonGenerator.find_rooms()
	print("Found ", rooms.size(), " rooms.")
	for i in range(rooms.size()):
		print("Room ", i, ": ", rooms[i])
