extends SceneTree

func _init():
	print("Starting test...")
	var main_scene = load("res://scenes/Main.tscn")
	var root = main_scene.instantiate()
	var generator = root.get_node("DungeonGenerator")
	var tilemap = root.get_node("TileMapLayer")
	
	generator.generate(tilemap)
	var used = tilemap.get_used_cells()
	var s1 = ""
	for i in range(100, 105):
		s1 += str(used[i]) + ":" + str(tilemap.get_cell_source_id(used[i])) + ","
	print("S1: ", s1)
	
	generator.seed = 99
	generator.generate(tilemap)
	used = tilemap.get_used_cells()
	var s2 = ""
	for i in range(100, 105):
		s2 += str(used[i]) + ":" + str(tilemap.get_cell_source_id(used[i])) + ","
	print("S2: ", s2)
	
	quit()
