extends Node3D

var grid_map: GridMap

func get_grid_map() -> GridMap:
	if not grid_map:
		grid_map = get_node("GridMap") as GridMap
	return grid_map

func build() -> void:
	var g_map = get_grid_map()
	if not g_map:
		push_error("GridMap node not found!")
		return
	
	# Create MeshLibrary
	var mesh_lib = MeshLibrary.new()
	
	# Create BoxMeshes with distinct StandardMaterial3D albedo colors
	var colors = [
		Color(1.0, 0.0, 0.0), # Red for ID 0
		Color(0.0, 1.0, 0.0), # Green for ID 1
		Color(0.0, 0.0, 1.0)  # Blue for ID 2
	]
	
	for i in range(3):
		mesh_lib.create_item(i)
		var mesh = BoxMesh.new()
		var mat = StandardMaterial3D.new()
		mat.albedo_color = colors[i]
		mesh.material = mat
		mesh_lib.set_item_mesh(i, mesh)
		mesh_lib.set_item_name(i, "Item_" + str(i))
	
	g_map.mesh_library = mesh_lib
	g_map.clear()
	
	# Load level.json
	var file = FileAccess.open("res://data/level.json", FileAccess.READ)
	if not file:
		push_error("Failed to open res://data/level.json")
		return
		
	var json_text = file.get_as_text()
	file.close()
	
	var data = JSON.parse_string(json_text)
	if typeof(data) != TYPE_DICTIONARY or not data.has("cells"):
		push_error("Invalid JSON structure in level.json")
		return
		
	for cell in data["cells"]:
		if typeof(cell) != TYPE_DICTIONARY:
			continue
		if not (cell.has("id") and cell.has("x") and cell.has("y") and cell.has("z")):
			continue
		var id = int(cell["id"])
		var x = int(cell["x"])
		var y = int(cell["y"])
		var z = int(cell["z"])
		g_map.set_cell_item(Vector3i(x, y, z), id)

func place(item_id: int, gx: int, gy: int, gz: int) -> void:
	var g_map = get_grid_map()
	if g_map:
		g_map.set_cell_item(Vector3i(gx, gy, gz), item_id)

func remove(gx: int, gy: int, gz: int) -> void:
	var g_map = get_grid_map()
	if g_map:
		g_map.set_cell_item(Vector3i(gx, gy, gz), -1)

func get_item(gx: int, gy: int, gz: int) -> int:
	var g_map = get_grid_map()
	if g_map:
		return g_map.get_cell_item(Vector3i(gx, gy, gz))
	return -1
