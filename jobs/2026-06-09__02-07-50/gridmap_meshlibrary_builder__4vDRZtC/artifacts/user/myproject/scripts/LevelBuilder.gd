extends Node3D

@onready var grid_map: GridMap = $GridMap


func build() -> void:
	# Create a fresh MeshLibrary with three items.
	var lib := MeshLibrary.new()

	# Item 0 – Red box
	lib.create_item(0)
	var mesh0 := BoxMesh.new()
	var mat0 := StandardMaterial3D.new()
	mat0.albedo_color = Color.RED
	mesh0.material = mat0
	lib.set_item_mesh(0, mesh0)

	# Item 1 – Green box
	lib.create_item(1)
	var mesh1 := BoxMesh.new()
	var mat1 := StandardMaterial3D.new()
	mat1.albedo_color = Color.GREEN
	mesh1.material = mat1
	lib.set_item_mesh(1, mesh1)

	# Item 2 – Blue box
	lib.create_item(2)
	var mesh2 := BoxMesh.new()
	var mat2 := StandardMaterial3D.new()
	mat2.albedo_color = Color.BLUE
	mesh2.material = mat2
	lib.set_item_mesh(2, mesh2)

	# Assign the library and clear any existing cells.
	grid_map.mesh_library = lib
	grid_map.clear()

	# Load and parse the level layout.
	var file := FileAccess.open("res://data/level.json", FileAccess.READ)
	if file == null:
		push_error("Failed to open res://data/level.json")
		return
	var json_text := file.get_as_text()
	file.close()

	var json := JSON.new()
	var err := json.parse(json_text)
	if err != OK:
		push_error("Failed to parse res://data/level.json: " + json.get_error_message())
		return

	var data: Dictionary = json.data
	var cells: Array = data["cells"]
	for cell: Dictionary in cells:
		var id: int = int(cell["id"])
		var x: int = int(cell["x"])
		var y: int = int(cell["y"])
		var z: int = int(cell["z"])
		grid_map.set_cell_item(Vector3i(x, y, z), id)


func place(item_id: int, gx: int, gy: int, gz: int) -> void:
	grid_map.set_cell_item(Vector3i(gx, gy, gz), item_id)


func remove(gx: int, gy: int, gz: int) -> void:
	grid_map.set_cell_item(Vector3i(gx, gy, gz), GridMap.INVALID_CELL_ITEM)


func get_item(gx: int, gy: int, gz: int) -> int:
	return grid_map.get_cell_item(Vector3i(gx, gy, gz))