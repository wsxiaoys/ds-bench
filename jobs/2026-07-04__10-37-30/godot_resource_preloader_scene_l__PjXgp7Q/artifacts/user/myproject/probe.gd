extends SceneTree

func _initialize():
	print("INITIALIZE root children: ", root.get_child_count())
	for c in root.get_children():
		print("  ", c.name, " ", c.get_class())
	quit()