extends SceneTree

func _initialize():
	print("--- Running Headless Locomotion/Attack Test ---")
	
	# Load the Player scene
	var player_scene = load("res://scenes/Player.tscn")
	if not player_scene:
		print("FAILED: Player.tscn could not be loaded!")
		quit(1)
		return
		
	var player = player_scene.instantiate()
	if not player:
		print("FAILED: Player scene could not be instantiated!")
		quit(1)
		return
		
	root.add_child(player)
	
	# Wait for a frame to let everything initialize and get ready
	await process_frame
	
	var anim_tree: AnimationTree = player.get_node("AnimationTree")
	var anim_player: AnimationPlayer = player.get_node("AnimationPlayer")
	var controller = player.get_node("PlayerAnimController")
	
	if not anim_tree or not anim_player or not controller:
		print("FAILED: Missing required child nodes!")
		quit(1)
		return
		
	# Activate the AnimationTree
	anim_tree.active = true
	
	# Initial advance to start the state machine
	anim_tree.advance(0.1)
	await process_frame
	
	# Test 1: Initial state should be Locomotion
	var state = controller.current_state()
	print("Initial State: ", state)
	if state != &"Locomotion":
		print("FAILED: Initial state is not Locomotion, got: ", state)
		quit(1)
		return
	
	# Test 2: Set move input
	controller.set_move_input(Vector2(0.5, -0.5))
	var blend_pos = anim_tree.get("parameters/Locomotion/blend_position")
	print("Blend Position after set_move_input(0.5, -0.5): ", blend_pos)
	if blend_pos != Vector2(0.5, -0.5):
		print("FAILED: Blend position not set correctly!")
		quit(1)
		return
		
	# Test 3: Trigger attack
	print("Triggering attack...")
	controller.trigger_attack()
	
	# Advance anim_tree to process transition
	anim_tree.advance(0.1)
	await process_frame # Let controller's _process run
	
	state = controller.current_state()
	print("State after trigger_attack() + advance: ", state)
	if state != &"Attack":
		print("FAILED: State did not transition to Attack, got: ", state)
		quit(1)
		return
		
	# Check if condition_attack was reset by _process
	var cond_attack = anim_tree.get("parameters/conditions/condition_attack")
	print("condition_attack after transition: ", cond_attack)
	if cond_attack:
		print("FAILED: condition_attack was not reset to false!")
		quit(1)
		return
		
	# Advance anim_tree to complete the attack animation (length is 1.0s)
	print("Advancing to complete attack animation...")
	anim_tree.advance(1.0)
	await process_frame # Let controller's _process run
	
	state = controller.current_state()
	print("State after completing attack: ", state)
	if state != &"Locomotion":
		print("FAILED: State did not transition back to Locomotion, got: ", state)
		quit(1)
		return
		
	print("ALL TESTS PASSED SUCCESSFULLY!")
	quit(0)
