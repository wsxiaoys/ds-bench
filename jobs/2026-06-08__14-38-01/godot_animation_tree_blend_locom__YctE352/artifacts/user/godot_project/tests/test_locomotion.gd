extends SceneTree

func _init():
	# Wait for a frame to ensure tree is ready
	await process_frame
	run_tests()

func run_tests():
	print("Running locomotion tests...")
	var player_scene = load("res://scenes/Player.tscn")
	if not player_scene:
		printerr("Failed to load Player.tscn")
		quit(1)
		return

	var player = player_scene.instantiate()
	root.add_child(player)

	var anim_tree = player.get_node("AnimationTree")
	var controller = player.get_node("PlayerAnimController")

	# Activate AnimationTree as the harness would
	anim_tree.active = true

	# Test 1: set_move_input
	controller.set_move_input(Vector2(1, 0))
	var blend_pos = anim_tree.get("parameters/Locomotion/blend_position")
	print("Blend position set to (1,0): ", blend_pos)
	if blend_pos.distance_to(Vector2(1, 0)) > 0.01:
		printerr("Test 1 failed: blend position is not (1,0)")
		quit(1)
		return

	# Let the state machine process a frame so it enters Locomotion
	await process_frame
	print("Current state: ", controller.current_state())
	if controller.current_state() != &"Locomotion":
		printerr("Test 2 failed: current state is not Locomotion, got: ", controller.current_state())
		quit(1)
		return

	# Test 3: trigger_attack
	controller.trigger_attack()
	print("Triggered attack. Waiting 1 frame...")
	await process_frame
	print("Current state after 1 frame: ", controller.current_state())
	if controller.current_state() != &"Attack":
		print("Waiting another frame...")
		await process_frame
		print("Current state after 2 frames: ", controller.current_state())
		if controller.current_state() != &"Attack":
			printerr("Test 3 failed: current state is not Attack after 2 frames")
			quit(1)
			return

	print("Locomotion tests passed successfully!")
	quit(0)
