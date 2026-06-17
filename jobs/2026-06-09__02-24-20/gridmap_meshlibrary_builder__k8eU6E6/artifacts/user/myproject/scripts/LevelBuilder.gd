extends Node3D
## LevelBuilder — procedural GridMap level builder.
##
## Builds a MeshLibrary in code (three item IDs 0,1,2 with distinct
## StandardMaterial3D albedo colors), assigns it to a child GridMap,
## and populates the grid from res://data/level.json.
##
## Public API:
##   build() -> void
##   place(item_id: int, gx: int, gy: int, gz: int) -> void
##   remove(gx: int, gy: int, gz: int) -> void
##   get_item(gx: int, gy: int, gz: int) -> int


# ---------------------------------------------------------------------------
# Public methods
# ---------------------------------------------------------------------------

## Build the MeshLibrary, assign it to the child GridMap, clear all cells,
## and populate the grid from res://data/level.json.
func build() -> void:
	var grid_map := _get_grid_map()

	# 1. Create MeshLibrary with three items.
	var lib := MeshLibrary.new()

	for item_id: int in [0, 1, 2]:
		var mesh := _make_box_mesh(item_id)
		var mat := _make_material(item_id)
		mesh.surface_set_material(0, mat)

		lib.create_item(item_id)
		lib.set_item_mesh(item_id, mesh)

	grid_map.mesh_library = lib

	# 2. Clear any existing cells.
	grid_map.clear()

	# 3. Load level layout from JSON.
	var cells: Array = _load_level_data()
	for entry: Dictionary in cells:
		var id: int = entry["id"]
		var x: int = entry["x"]
		var y: int = entry["y"]
		var z: int = entry["z"]
		grid_map.set_cell_item(Vector3i(x, y, z), id)


## Place a cell at (gx, gy, gz) with the given item_id.
func place(item_id: int, gx: int, gy: int, gz: int) -> void:
	var grid_map := _get_grid_map()
	grid_map.set_cell_item(Vector3i(gx, gy, gz), item_id)


## Remove (clear) the cell at (gx, gy, gz).
func remove(gx: int, gy: int, gz: int) -> void:
	var grid_map := _get_grid_map()
	grid_map.set_cell_item(Vector3i(gx, gy, gz), GridMap.INVALID_CELL_ITEM)


## Return the item id at (gx, gy, gz), or -1 if the cell is empty.
func get_item(gx: int, gy: int, gz: int) -> int:
	var grid_map := _get_grid_map()
	return grid_map.get_cell_item(Vector3i(gx, gy, gz))


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

## Resolve the child GridMap node.  Cached after first lookup.
var _grid_map_cache: GridMap = null

func _get_grid_map() -> GridMap:
	if _grid_map_cache == null:
		_grid_map_cache = $GridMap as GridMap
		assert(_grid_map_cache != null, "Child node 'GridMap' of type GridMap not found!")
	return _grid_map_cache


## Create a simple BoxMesh for the given item_id.
func _make_box_mesh(_item_id: int) -> BoxMesh:
	var box := BoxMesh.new()
	box.size = Vector3(1.0, 1.0, 1.0)
	return box


## Create a distinct StandardMaterial3D for each item_id.
## Colors:
##   0 → red
##   1 → green
##   2 → blue
func _make_material(item_id: int) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	match item_id:
		0:
			mat.albedo_color = Color(1.0, 0.0, 0.0, 1.0)  # red
		1:
			mat.albedo_color = Color(0.0, 1.0, 0.0, 1.0)  # green
		2:
			mat.albedo_color = Color(0.0, 0.0, 1.0, 1.0)  # blue
		_:
			mat.albedo_color = Color(1.0, 1.0, 1.0, 1.0)  # white fallback
	return mat


## Load and parse the JSON level layout from res://data/level.json.
## Returns the "cells" array.
func _load_level_data() -> Array:
	var file := FileAccess.open("res://data/level.json", FileAccess.READ)
	assert(file != null, "Failed to open res://data/level.json!")
	var text := file.get_as_text()
	file.close()

	var data = JSON.parse_string(text)
	assert(data != null, "Failed to parse res://data/level.json!")
	assert(data.has("cells"), "data/level.json missing 'cells' key!")

	return data["cells"]
