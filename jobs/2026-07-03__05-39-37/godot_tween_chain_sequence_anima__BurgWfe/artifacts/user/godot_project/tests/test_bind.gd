extends SceneTree

func _init() -> void:
	var node := Node2D.new()
	get_root().add_child(node)

	# SceneTree.create_tween() + bind_node + pause + custom_step
	var tween := create_tween()
	tween.bind_node(node)
	tween.tween_property(node, "position", Vector2(200, 100), 1.0)

	tween.pause()
	for i in range(50):
		tween.custom_step(0.01)
	print("With bind_node, after 50 steps: position = ", node.position)

	quit()