extends SceneTree

func _init() -> void:
	var node := Node2D.new()
	get_root().add_child(node)

	# Use SceneTree.create_tween() — this works with custom_step
	var tween := create_tween()
	tween.tween_property(node, "position", Vector2(200, 100), 1.0)

	print("valid: ", tween.is_valid(), " running: ", tween.is_running())

	# Pause immediately, then custom_step
	tween.pause()
	print("After pause, running: ", tween.is_running())

	for i in range(50):
		tween.custom_step(0.01)
	print("After 50 custom_steps (0.5s): position = ", node.position)

	for i in range(50):
		tween.custom_step(0.01)
	print("After 100 custom_steps (1.0s): position = ", node.position)

	quit()