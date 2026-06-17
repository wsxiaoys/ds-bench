extends SceneTree

func _init():
	_run.call_deferred()

func _run():
	print("Starting animator tests...")
	var scene = load("res://scenes/Animator.tscn")
	var instance = scene.instantiate()
	
	# We must add the instance to the root of the SceneTree to make sure it's active
	root.add_child(instance)
	
	# Await a frame to let everything initialize and _ready() run
	await process_frame
	
	var controller = instance.get_node("TweenController")
	var target = instance.get_node("Target")
	
	var counts = {
		"a": 0,
		"b": 0,
		"c": 0,
		"done": 0
	}
	
	controller.step_a_complete.connect(func(): counts["a"] += 1)
	controller.step_b_complete.connect(func(): counts["b"] += 1)
	controller.step_c_complete.connect(func(): counts["c"] += 1)
	controller.animation_complete.connect(func(): counts["done"] += 1)
	
	var tween = controller.play_sequence()
	assert(tween != null, "play_sequence must return a Tween")
	assert(controller.is_running() == true, "is_running must be true during animation")
	
	# Pause the tween so we can drive it manually
	tween.pause()
	
	# Let's run custom step in a loop
	var steps = int(3.50 / 0.01)
	for i in range(1, steps + 1):
		var time = i * 0.01
		var finished = tween.custom_step(0.01)
		
		# Wait, let's print states at checkpoints to debug
		if abs(time - 0.50) < 0.001:
			print("t = 0.50:")
			print("  position: ", target.position)
			print("  signals: a=", counts["a"], " b=", counts["b"], " c=", counts["c"], " done=", counts["done"])
			assert(target.position.is_equal_approx(Vector2(100, 50)), "Position at 0.50 should be approx (100, 50)")
			assert(counts["a"] == 0 and counts["b"] == 0 and counts["c"] == 0 and counts["done"] == 0, "Signals at 0.50 should be all 0")
			
		elif abs(time - 1.00) < 0.001:
			print("t = 1.00:")
			print("  position: ", target.position)
			print("  signals: a=", counts["a"], " b=", counts["b"], " c=", counts["c"], " done=", counts["done"])
			assert(target.position.is_equal_approx(Vector2(200, 100)), "Position at 1.00 should be exactly (200, 100)")
			assert(counts["a"] == 1 and counts["b"] == 0 and counts["c"] == 0 and counts["done"] == 0, "step_a_complete should have fired exactly once")
			
		elif abs(time - 1.50) < 0.001:
			print("t = 1.50:")
			print("  scale: ", target.scale)
			print("  modulate.a: ", target.modulate.a)
			print("  signals: a=", counts["a"], " b=", counts["b"], " c=", counts["c"], " done=", counts["done"])
			assert(target.scale.is_equal_approx(Vector2(1.5, 1.5)), "Scale at 1.50 should be approx (1.5, 1.5)")
			assert(is_equal_approx(target.modulate.a, 0.75), "Modulate alpha at 1.50 should be approx 0.75")
			assert(counts["a"] == 1 and counts["b"] == 0 and counts["c"] == 0 and counts["done"] == 0, "Signals at 1.50 should be a=1, others 0")
			
		elif abs(time - 2.00) < 0.001:
			print("t = 2.00:")
			print("  scale: ", target.scale)
			print("  modulate.a: ", target.modulate.a)
			print("  signals: a=", counts["a"], " b=", counts["b"], " c=", counts["c"], " done=", counts["done"])
			assert(target.scale.is_equal_approx(Vector2(2.0, 2.0)), "Scale at 2.00 should be exactly (2, 2)")
			assert(is_equal_approx(target.modulate.a, 0.5), "Modulate alpha at 2.00 should be exactly 0.5")
			assert(counts["a"] == 1 and counts["b"] == 1 and counts["c"] == 0 and counts["done"] == 0, "step_b_complete should have fired exactly once")
			
		elif abs(time - 3.00) < 0.001:
			print("t = 3.00:")
			print("  rotation: ", target.rotation)
			print("  signals: a=", counts["a"], " b=", counts["b"], " c=", counts["c"], " done=", counts["done"])
			assert(is_equal_approx(target.rotation, PI / 2.0), "Rotation at 3.00 should be exactly PI/2")
			assert(counts["a"] == 1 and counts["b"] == 1 and counts["c"] == 1 and counts["done"] == 0, "step_c_complete should have fired exactly once")
			
		elif abs(time - 3.50) < 0.001:
			print("t = 3.50:")
			print("  modulate: ", target.modulate)
			print("  signals: a=", counts["a"], " b=", counts["b"], " c=", counts["c"], " done=", counts["done"])
			print("  is_running: ", controller.is_running())
			assert(target.modulate.is_equal_approx(Color(0.5, 1.0, 1.0, 1.0)), "Modulate at 3.50 should be Color(0.5, 1, 1, 1)")
			assert(counts["a"] == 1 and counts["b"] == 1 and counts["c"] == 1 and counts["done"] == 1, "animation_complete should have fired exactly once")
			assert(controller.is_running() == false, "is_running should be false at 3.50")
			
	print("All checks passed successfully!")
	quit()
