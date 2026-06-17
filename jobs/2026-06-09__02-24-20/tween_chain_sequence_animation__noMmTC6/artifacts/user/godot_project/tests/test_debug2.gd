extends SceneTree

func _init() -> void:
	var scene: PackedScene = load("res://scenes/Animator.tscn")
	var instance: Node = scene.instantiate()
	root.add_child(instance)

	var controller: Node = instance.get_node("TweenController")
	var target: Node2D = instance.get_node("Target")

	var tween: Tween = controller.play_sequence()

	# Try custom_step WITHOUT pausing first
	print("custom_step without pause...")
	for i in range(5):
		tween.custom_step(0.01)
	print("position after 5 steps (no pause): ", target.position)

	# Now pause and try
	tween.pause()
	print("Paused. custom_step again...")
	for i in range(5):
		tween.custom_step(0.01)
	print("position after 5 more steps (paused): ", target.position)

	# Try a fresh instance with pause first, then process_frame, then custom_step
	instance.queue_free()

	instance = scene.instantiate()
	root.add_child(instance)
	controller = instance.get_node("TweenController")
	target = instance.get_node("Target")

	tween = controller.play_sequence()
	tween.pause()
	print("\nFresh instance, paused immediately. Trying custom_step...")
	for i in range(5):
		tween.custom_step(0.01)
	print("position: ", target.position)

	# Try unpausing briefly then pausing again
	print("Unpausing...")
	tween.play()
	# Let one frame process
	await self.process_frame
	tween.pause()
	print("After one frame then pause. Trying custom_step...")
	for i in range(5):
		tween.custom_step(0.01)
	print("position: ", target.position)

	quit(0)
