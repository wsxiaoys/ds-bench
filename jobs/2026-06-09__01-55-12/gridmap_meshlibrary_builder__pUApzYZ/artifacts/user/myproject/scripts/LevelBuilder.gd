extends Node3D

# Item ID → albedo color mapping (three pairwise-distinct, non-default colors)
const ITEM_COLORS := {
	0: Color(1.0, 0.2, 0.2),   # red
	1: Color(0.2, 1.0, 0.2),   # green
	2: Color(0.2, 0.4, 1.0),   # blue
}

var _grid_map: GridMap


func _ready() -> void:
	_grid_map = $GridMap


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

## Build the MeshLibrary, assign it to the child GridMap, and populate from JSON.
func build() -> void:
	if _grid_map == null:
		_grid_map = $GridMap

	# -- Build MeshLibrary in code ------------------------------------------
	var library := MeshLibrary.new()

	for item_id in ITEM_COLORS.keys():
		var mesh := BoxMesh.new()
		var mat := StandardMaterial3D.new()
		mat.albedo_color = ITEM_COLORS[item_id]
		mesh.surface_set_material(0, mat)

		library.create_item(item_id)
		library.set_item_mesh(item_id, mesh)

	_grid_map.mesh_library = library

	# -- Clear any pre-existing cells ----------------------------------------
	_grid_map.clear()

	# -- Populate from res://data/level.json ---------------------------------
	var file := FileAccess.open("res://data/level.json", FileAccess.READ)
	if file == null:
		push_error("LevelBuilder: cannot open res://data/level.json (error %d)" % FileAccess.get_open_error())
		return

	var raw := file.get_as_text()
	file.close()

	var parsed = JSON.parse_string(raw)
	if parsed == null:
		push_error("LevelBuilder: failed to parse level.json")
		return

	var cells: Array = parsed.get("cells", [])
	for entry in cells:
		var id: int  = int(entry["id"])
		var x: int   = int(entry["x"])
		var y: int   = int(entry["y"])
		var z: int   = int(entry["z"])
		_grid_map.set_cell_item(Vector3i(x, y, z), id)


## Place item_id at grid coordinate (gx, gy, gz).
func place(item_id: int, gx: int, gy: int, gz: int) -> void:
	_grid_map.set_cell_item(Vector3i(gx, gy, gz), item_id)


## Remove (clear) the cell at grid coordinate (gx, gy, gz).
func remove(gx: int, gy: int, gz: int) -> void:
	_grid_map.set_cell_item(Vector3i(gx, gy, gz), GridMap.INVALID_CELL_ITEM)


## Return the item id at (gx, gy, gz), or -1 if empty.
func get_item(gx: int, gy: int, gz: int) -> int:
	return _grid_map.get_cell_item(Vector3i(gx, gy, gz))
