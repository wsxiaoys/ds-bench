extends SceneTree

func _init():
	print("Running tests...")
	call_deferred("run_tests")

func run_tests():
	# 1. Instantiate the ragdoll
	var ragdoll_scene = load("res://scenes/Ragdoll.tscn")
	var ragdoll = ragdoll_scene.instantiate()
	root.add_child(ragdoll)
	
	# Verify the script is attached
	var ragdoll_script = load("res://scripts/Ragdoll.gd")
	assert(ragdoll.get_script() == ragdoll_script, "Ragdoll is not of class_name Ragdoll")
	print("Class name check passed!")
	
	# Verify body parts
	for name in ["Head", "Torso", "LeftArm", "RightArm", "LeftLeg", "RightLeg"]:
		var part = ragdoll.get_part(StringName(name))
		assert(part != null, "Missing part: " + name)
		assert(part.name == name, "Part name mismatch for: " + name)
	print("get_part check passed!")
	
	# Verify joints
	# The unordered set of (node_a, node_b) body-name pairs:
	# { (Head,Torso), (LeftArm,Torso), (RightArm,Torso), (LeftLeg,Torso), (RightLeg,Torso) }
	var joints = []
	for child in ragdoll.get_children():
		if child is PinJoint2D:
			joints.append(child)
	assert(joints.size() == 5, "Expected exactly 5 PinJoint2D nodes, got: " + str(joints.size()))
	
	var expected_pairs = [
		["Head", "Torso"],
		["LeftArm", "Torso"],
		["RightArm", "Torso"],
		["LeftLeg", "Torso"],
		["RightLeg", "Torso"]
	]
	
	var actual_pairs = []
	for joint in joints:
		var node_a_path = joint.node_a
		var node_b_path = joint.node_b
		var node_a = joint.get_node_or_null(node_a_path)
		var node_b = joint.get_node_or_null(node_b_path)
		print("Joint name: ", joint.name, " node_a_path: ", node_a_path, " node_b_path: ", node_b_path, " node_a: ", node_a, " node_b: ", node_b)
		assert(node_a != null, "node_a is null for joint: " + joint.name)
		assert(node_b != null, "node_b is null for joint: " + joint.name)
		assert(node_a is RigidBody2D, "node_a is not RigidBody2D")
		assert(node_b is RigidBody2D, "node_b is not RigidBody2D")
		var pair = [str(node_a.name), str(node_b.name)]
		pair.sort()
		actual_pairs.append(pair)
	print("Actual pairs: ", actual_pairs)
		
	# Check sets
	for exp_pair in expected_pairs:
		var sorted_exp = exp_pair.duplicate()
		sorted_exp.sort()
		var found = false
		for act_pair in actual_pairs:
			if act_pair == sorted_exp:
				found = true
				break
		assert(found, "Expected pair not found: " + str(sorted_exp))
	print("PinJoint2D connections check passed!")
	
	# Test freeze_all
	ragdoll.freeze_all(true)
	for name in ["Head", "Torso", "LeftArm", "RightArm", "LeftLeg", "RightLeg"]:
		assert(ragdoll.get_part(StringName(name)).freeze == true, name + " was not frozen")
	ragdoll.freeze_all(false)
	for name in ["Head", "Torso", "LeftArm", "RightArm", "LeftLeg", "RightLeg"]:
		assert(ragdoll.get_part(StringName(name)).freeze == false, name + " was not unfrozen")
	print("freeze_all check passed!")
	
	# Test apply_impulse_to after one physics frame
	# Let's wait for one physics frame.
	await physics_frame
	
	ragdoll.apply_impulse_to(StringName("Head"), Vector2(0, -500))
	
	await physics_frame
	
	var head_vel = ragdoll.get_part(StringName("Head")).linear_velocity
	print("Head linear velocity after impulse: ", head_vel)
	assert(head_vel.y < -1.0, "Head linear velocity Y is not < -1.0, got: " + str(head_vel.y))
	print("apply_impulse_to check passed!")
	
	# Test collapse signal
	# Let's build a floor so it can fall and rest
	var floor_body = StaticBody2D.new()
	var floor_shape = CollisionShape2D.new()
	var floor_rect = RectangleShape2D.new()
	floor_rect.size = Vector2(1000, 50)
	floor_shape.shape = floor_rect
	floor_body.add_child(floor_shape)
	floor_body.position = Vector2(0, 200) # below ragdoll
	root.add_child(floor_body)
	
	var state = {
		"received": false,
		"avg_pos": Vector2.ZERO,
		"frame_received": -1,
		"emitted_count": 0
	}
	
	ragdoll.ragdoll_collapsed.connect(func(avg_pos):
		state["received"] = true
		state["avg_pos"] = avg_pos
		state["emitted_count"] += 1
		print("ragdoll_collapsed signal received at avg_pos: ", avg_pos, " total count: ", state["emitted_count"])
	)
	
	# Simulate for ~4 seconds (240 frames)
	for i in range(240):
		await physics_frame
		if state["received"] and state["frame_received"] == -1:
			state["frame_received"] = i
			# check that emitted centroid matches average position at that moment (at emission frame)
			var current_avg = ragdoll.get_average_position()
			var diff = state["avg_pos"].distance_to(current_avg)
			print("Frame ", i, " - Signal received avg_pos: ", state["avg_pos"], " Current avg_pos: ", current_avg, " Diff: ", diff)
			assert(diff < 0.01, "Signal avg_pos does not match current avg_pos!")
	
	assert(state["received"], "ragdoll_collapsed was not emitted!")
	assert(state["emitted_count"] == 1, "ragdoll_collapsed emitted " + str(state["emitted_count"]) + " times, expected exactly 1")
	print("ragdoll_collapsed check passed!")
	
	print("All tests passed successfully!")
	quit()
