extends Node3D

func get_grid_map_node() -> GridMap:
	return get_node_or_null("GridMap") as GridMap

func build() -> void:
	var grid_map = get_grid_map_node()
	if grid_map == null:
		push_error("GridMap node not found!")
		return
	
	# 1. Build the MeshLibrary
	var mesh_library = MeshLibrary.new()
	
	# Item 0
	mesh_library.create_item(0)
	mesh_library.set_item_name(0, "Item0")
	var box0 = BoxMesh.new()
	var mat0 = StandardMaterial3D.new()
	mat0.albedo_color = Color(0.8, 0.1, 0.1) # Distinct Red
	box0.material = mat0
	mesh_library.set_item_mesh(0, box0)
	
	# Item 1
	mesh_library.create_item(1)
	mesh_library.set_item_name(1, "Item1")
	var box1 = BoxMesh.new()
	var mat1 = StandardMaterial3D.new()
	mat1.albedo_color = Color(0.1, 0.8, 0.1) # Distinct Green
	box1.material = mat1
	mesh_library.set_item_mesh(1, box1)
	
	# Item 2
	mesh_library.create_item(2)
	mesh_library.set_item_name(2, "Item2")
	var box2 = BoxMesh.new()
	var mat2 = StandardMaterial3D.new()
	mat2.albedo_color = Color(0.1, 0.1, 0.8) # Distinct Blue
	box2.material = mat2
	mesh_library.set_item_mesh(2, box2)
	
	# Assign the library to the child GridMap
	grid_map.mesh_library = mesh_library
	
	# 2. Clear existing cells
	grid_map.clear()
	
	# 3. Populate GridMap from res://data/level.json
	var file_path = "res://data/level.json"
	if not FileAccess.file_exists(file_path):
		push_error("Level JSON file not found at: " + file_path)
		return
		
	var file = FileAccess.open(file_path, FileAccess.READ)
	if file == null:
		push_error("Failed to open level JSON file!")
		return
		
	var json_string = file.get_as_text()
	file.close()
	
	var json_data = JSON.parse_string(json_string)
	if json_data == null:
		push_error("Failed to parse level JSON!")
		return
		
	if json_data.has("cells") and typeof(json_data["cells"]) == TYPE_ARRAY:
		for cell in json_data["cells"]:
			if typeof(cell) == TYPE_DICTIONARY:
				var item_id = int(cell.get("id", 0))
				var gx = int(cell.get("x", 0))
				var gy = int(cell.get("y", 0))
				var gz = int(cell.get("z", 0))
				place(item_id, gx, gy, gz)

func place(item_id: int, gx: int, gy: int, gz: int) -> void:
	var grid_map = get_grid_map_node()
	if grid_map != null:
		grid_map.set_cell_item(Vector3i(gx, gy, gz), item_id)

func remove(gx: int, gy: int, gz: int) -> void:
	var grid_map = get_grid_map_node()
	if grid_map != null:
		grid_map.set_cell_item(Vector3i(gx, gy, gz), GridMap.INVALID_CELL_ITEM)

func get_item(gx: int, gy: int, gz: int) -> int:
	var grid_map = get_grid_map_node()
	if grid_map != null:
		return grid_map.get_cell_item(Vector3i(gx, gy, gz))
	return -1
