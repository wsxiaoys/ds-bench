extends SceneTree

func _init() -> void:
	var scene: PackedScene = load("res://scenes/Animator.tscn")
	var instance: Node = scene.instantiate()
	root.add_child(instance)

	var controller: Node = instance.get_node("TweenController")
	var target: Node2D = instance.get_node("Target")

	var tween: Tween = controller.play_sequence()
	print("tween valid: ", tween.is_valid())
	print("tween is running: ", tween.is_running())

	# Don't pause — let's see if it runs naturally
	print("Waiting 0.1s...")
	await create_timer(0.1).timeout
	print("After 0.1s: position=", target.position, " scale=", target.scale, " rotation=", target.rotation, " modulate=", target.modulate)

	# Now pause and try custom_step
	tween.pause()
	print("Paused. custom_step 0.01 x 10...")
	for i in range(10):
		tween.custom_step(0.01)
	print("After 10 steps: position=", target.position, " scale=", target.scale, " rotation=", target.rotation, " modulate=", target.modulate)

	quit(0)
