extends Node3D
## Procedural GridMap Level Builder.
##
## Builds a [MeshLibrary] entirely in code, assigns it to a child [GridMap],
## and populates the grid from a deterministic JSON layout at
## [code]res://data/level.json[/code]. Exposes a small public API to place,
## query and remove cells at runtime.

const LEVEL_PATH := "res://data/level.json"

var _grid_map: GridMap


func _ready() -> void:
	# Cache the child GridMap as soon as we enter the tree, but every public
	# method is also safe to call directly from an external caller.
	_grid_map = get_node("GridMap")


func build() -> void:
	# Make sure we have a reference even if build() is called before _ready or
	# by an external caller that never added us to the tree.
	if _grid_map == null:
		_grid_map = get_node("GridMap")

	# Build the MeshLibrary entirely in code with item ids 0, 1 and 2.
	var library := MeshLibrary.new()
	_register_item(library, 0, Color(1.00, 0.22, 0.22), Vector3(1.0, 1.0, 1.0))
	_register_item(library, 1, Color(0.22, 1.00, 0.30), Vector3(0.9, 1.1, 0.9))
	_register_item(library, 2, Color(0.25, 0.45, 1.00), Vector3(1.1, 0.9, 1.0))

	_grid_map.mesh_library = library
	_grid_map.clear()
	_populate_from_json(LEVEL_PATH)


func place(item_id: int, gx: int, gy: int, gz: int) -> void:
	_grid_map.set_cell_item(Vector3i(gx, gy, gz), item_id)


func remove(gx: int, gy: int, gz: int) -> void:
	_grid_map.set_cell_item(Vector3i(gx, gy, gz), GridMap.INVALID_CELL_ITEM)


func get_item(gx: int, gy: int, gz: int) -> int:
	return _grid_map.get_cell_item(Vector3i(gx, gy, gz))


# --------------------------------------------------------------------------- #
# Internal helpers
# --------------------------------------------------------------------------- #

func _register_item(library: MeshLibrary, id: int, color: Color, size: Vector3) -> void:
	var mesh := BoxMesh.new()
	mesh.size = size
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	mesh.material = material
	library.create_item(id)
	library.set_item_mesh(id, mesh)
	library.set_item_name(id, "item_%d" % id)


func _populate_from_json(path: String) -> void:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("LevelBuilder: could not open '%s'" % path)
		return
	var text := file.get_as_text()
	file.close()

	var parsed = JSON.parse_string(text)
	if not (parsed is Dictionary) or not parsed.has("cells"):
		push_error("LevelBuilder: invalid level data in '%s'" % path)
		return

	for cell in parsed["cells"]:
		var item_id: int = int(cell["id"])
		var x: int = int(cell["x"])
		var y: int = int(cell["y"])
		var z: int = int(cell["z"])
		_grid_map.set_cell_item(Vector3i(x, y, z), item_id)