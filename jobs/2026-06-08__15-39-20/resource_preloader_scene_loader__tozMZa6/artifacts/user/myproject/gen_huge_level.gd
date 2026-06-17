extends SceneTree

func _init():
	var root = Node2D.new()
	root.name = "HugeLevel"
	for i in range(55):
		var child = Node2D.new()
		child.name = "Node" + str(i)
		root.add_child(child)
		child.owner = root
	
	var packed = PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, "res://scenes/HugeLevel.tscn")
	quit()
