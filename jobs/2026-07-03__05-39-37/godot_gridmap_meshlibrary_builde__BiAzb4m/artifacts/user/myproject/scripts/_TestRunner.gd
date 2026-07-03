extends SceneTree


func _init() -> void:
	var packed := load("res://scenes/Main.tscn") as PackedScene
	var root := packed.instantiate()
	get_root().add_child(root)

	root.build()

	var grid := root.get_node("GridMap") as GridMap
	var lib := grid.mesh_library as MeshLibrary

	# Check the three library items exist and have distinct, non-default colors.
	var colors := []
	for id in [0, 1, 2]:
		assert(lib.has_item(id), "library missing item %d" % id)
		var mesh := lib.get_item_mesh(id) as Mesh
		assert(mesh != null, "item %d has no mesh" % id)
		var mat := mesh.material as StandardMaterial3D
		assert(mat != null, "item %d has no StandardMaterial3D" % id)
		colors.append(mat.albedo_color)
		print("item %d color = %s" % [id, mat.albedo_color])

	assert(colors[0] != Color(1, 1, 1), "item 0 color is default white")
	assert(colors[1] != Color(1, 1, 1), "item 1 color is default white")
	assert(colors[2] != Color(1, 1, 1), "item 2 color is default white")
	assert(colors[0] != colors[1] and colors[1] != colors[2] and colors[0] != colors[2],
			"colors are not distinct")

	# Check a known cell from level.json then exercise the public API.
	assert(root.get_item(0, 0, 0) == 0, "expected item 0 at (0,0,0)")
	assert(root.get_item(2, 0, 0) == 2, "expected item 2 at (2,0,0)")
	assert(root.get_item(0, 1, 0) == 0, "expected item 0 at (0,1,0)")

	# Empty cell returns -1.
	assert(root.get_item(5, 5, 5) == -1, "expected -1 for empty cell")

	# place + get_item round trip.
	root.place(1, 5, 5, 5)
	assert(root.get_item(5, 5, 5) == 1, "place/get_item mismatch")

	# remove clears the cell.
	root.remove(5, 5, 5)
	assert(root.get_item(5, 5, 5) == -1, "remove did not clear cell")

	# build() is safe to call again and repopulates.
	root.build()
	assert(root.get_item(0, 0, 0) == 0, "rebuild did not repopulate")
	assert(root.get_item(5, 5, 5) == -1, "rebuild should have cleared runtime cells")

	print("ALL TESTS PASSED")
	quit()