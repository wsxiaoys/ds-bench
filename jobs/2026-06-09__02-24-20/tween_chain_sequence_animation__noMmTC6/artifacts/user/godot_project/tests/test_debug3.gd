extends SceneTree

func _init() -> void:
	var scene: PackedScene = load("res://scenes/Animator.tscn")
	var instance: Node = scene.instantiate()
	root.add_child(instance)

	var controller: Node = instance.get_node("TweenController")
	var target: Node2D = instance.get_node("Target")

	var tween: Tween = controller.play_sequence()

	# Process one frame so the tween is "started"
	await self.process_frame

	# Now pause and drive with custom_step
	tween.pause()

	print("After 1 frame + pause, position: ", target.position)

	# Now custom_step should work
	for i in range(10):
		tween.custom_step(0.01)
	print("After 10 custom_steps: position=", target.position, " (expected ~20,10)")

	quit(0)
