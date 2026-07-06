extends SceneTree

func _init() -> void:
	var node := Node2D.new()
	get_root().add_child(node)

	print("node position: ", node.position)

	# Approach 1: create_tween on node
	var tween := node.create_tween()
	tween.tween_property(node, "position", Vector2(200, 100), 1.0)
	print("tween valid: ", tween.is_valid())
	print("tween running: ", tween.is_running())

	for i in range(50):
		tween.custom_step(0.01)
	print("After 50 custom_steps: position = ", node.position)

	# Approach 2: create_tween on tree
	var node2 := Node2D.new()
	get_root().add_child(node2)
	var tween2 := create_tween()
	tween2.tween_property(node2, "position", Vector2(200, 100), 1.0)
	print("\ntween2 valid: ", tween2.is_valid())
	for i in range(50):
		tween2.custom_step(0.01)
	print("After 50 custom_steps: position2 = ", node2.position)

	# Approach 3: Tween.new()
	var node3 := Node2D.new()
	get_root().add_child(node3)
	var tween3 := Tween.new()
	tween3.tween_property(node3, "position", Vector2(200, 100), 1.0)
	print("\ntween3 valid: ", tween3.is_valid())
	for i in range(50):
		tween3.custom_step(0.01)
	print("After 50 custom_steps: position3 = ", node3.position)

	quit()