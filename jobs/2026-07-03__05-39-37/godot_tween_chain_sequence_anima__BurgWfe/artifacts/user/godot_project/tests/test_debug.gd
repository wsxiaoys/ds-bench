extends SceneTree

func _init() -> void:
	var scene: PackedScene = load("res://scenes/Animator.tscn")
	var root: Node2D = scene.instantiate()
	root.name = "AnimatorRoot"
	get_root().add_child(root)

	var ctrl: Node = root.get_node("TweenController")
	var target: Node2D = root.get_node("Target")

	var tween: Tween = ctrl.play_sequence()

	print("tween valid: ", tween.is_valid())
	print("tween running: ", tween.is_running())

	# Test 1: custom_step WITHOUT pausing
	print("\n--- Test 1: custom_step without pause ---")
	for i in range(50):
		tween.custom_step(0.01)
	print("After 50 steps (0.5s): position = ", target.position)

	# Test 2: pause then custom_step
	print("\n--- Test 2: pause then custom_step ---")
	tween.pause()
	for i in range(50):
		tween.custom_step(0.01)
	print("After 50 more steps (1.0s total): position = ", target.position)

	# Test 3: unpause then custom_step
	print("\n--- Test 3: unpause then custom_step ---")
	tween.play()
	for i in range(50):
		tween.custom_step(0.01)
	print("After 50 more steps (1.5s total): position = ", target.position)

	quit()