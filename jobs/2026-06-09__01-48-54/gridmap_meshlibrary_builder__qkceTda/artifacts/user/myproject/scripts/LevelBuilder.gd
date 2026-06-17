extends Node3D

func build() -> void:
    var mesh_lib = MeshLibrary.new()
    
    var colors = [Color(1, 0, 0), Color(0, 1, 0), Color(0, 0, 1)]
    
    for i in range(3):
        var mesh = BoxMesh.new()
        var mat = StandardMaterial3D.new()
        mat.albedo_color = colors[i]
        mesh.material = mat
        
        mesh_lib.create_item(i)
        mesh_lib.set_item_mesh(i, mesh)
    
    var gm = get_node("GridMap") as GridMap
    gm.mesh_library = mesh_lib
    gm.clear()
    
    var file = FileAccess.open("res://data/level.json", FileAccess.READ)
    if file:
        var text = file.get_as_text()
        var data = JSON.parse_string(text)
        if data and data.has("cells"):
            for cell in data["cells"]:
                var id = int(cell["id"])
                var x = int(cell["x"])
                var y = int(cell["y"])
                var z = int(cell["z"])
                gm.set_cell_item(Vector3i(x, y, z), id)

func place(item_id: int, gx: int, gy: int, gz: int) -> void:
    var gm = get_node("GridMap") as GridMap
    gm.set_cell_item(Vector3i(gx, gy, gz), item_id)

func remove(gx: int, gy: int, gz: int) -> void:
    var gm = get_node("GridMap") as GridMap
    gm.set_cell_item(Vector3i(gx, gy, gz), GridMap.INVALID_CELL_ITEM)

func get_item(gx: int, gy: int, gz: int) -> int:
    var gm = get_node("GridMap") as GridMap
    return gm.get_cell_item(Vector3i(gx, gy, gz))
