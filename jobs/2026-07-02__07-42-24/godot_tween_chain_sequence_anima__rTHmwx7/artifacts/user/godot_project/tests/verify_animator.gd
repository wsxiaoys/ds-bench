extends SceneTree

func _init():
	call_deferred("run_verification")

func run_verification():
	print("==================================================")
	print("STARTING ANIMATOR VERIFICATION")
	print("==================================================")
	
	var scene_path = "res://scenes/Animator.tscn"
	var scene = load(scene_path)
	if not scene:
		print("ERROR: Failed to load scene: ", scene_path)
		quit(1)
		return
		
	var animator = scene.instantiate()
	if not animator:
		print("ERROR: Failed to instantiate Animator scene")
		quit(1)
		return
		
	# Add to root so _ready is called and we have a valid SceneTree context
	root.add_child(animator)
	
	var target = animator.get_node("Target")
	var controller = animator.get_node("TweenController")
	
	if not target:
		print("ERROR: Target node not found under Animator!")
		quit(1)
		return
		
	if not controller:
		print("ERROR: TweenController node not found under Animator!")
		quit(1)
		return
		
	# Connect signals using a dictionary to capture by reference
	var counts = {
		"a": 0,
		"b": 0,
		"c": 0,
		"done": 0
	}
	
	controller.step_a_complete.connect(func():
		print("SIGNAL RECEIVED: step_a_complete")
		counts["a"] += 1
	)
	controller.step_b_complete.connect(func():
		print("SIGNAL RECEIVED: step_b_complete")
		counts["b"] += 1
	)
	controller.step_c_complete.connect(func():
		print("SIGNAL RECEIVED: step_c_complete")
		counts["c"] += 1
	)
	controller.animation_complete.connect(func():
		print("SIGNAL RECEIVED: animation_complete")
		counts["done"] += 1
	)
	
	# Play sequence
	var tween = controller.play_sequence()
	if not tween or not tween.is_valid():
		print("ERROR: play_sequence() did not return a valid Tween")
		quit(1)
		return
		
	# Pause the tween as the verifier would do
	tween.pause()
	
	var steps = 350
	var delta = 0.01
	
	var all_ok = true
	
	for i in range(steps):
		tween.custom_step(delta)
		var t = (i + 1) * delta
		
		# Checkpoints
		# t = 0.50s
		if abs(t - 0.50) < 0.0001:
			print("--- Checking t = 0.50s ---")
			print("Target position: ", target.position)
			print("Signal counts: a=%d b=%d c=%d done=%d" % [counts["a"], counts["b"], counts["c"], counts["done"]])
			print("is_running(): ", controller.is_running())
			
			if not target.position.is_equal_approx(Vector2(100, 50)):
				print("FAIL: Position at 0.50s is not approx (100, 50)")
				all_ok = false
			if counts["a"] != 0 or counts["b"] != 0 or counts["c"] != 0 or counts["done"] != 0:
				print("FAIL: Signal counts at 0.50s are not all 0")
				all_ok = false
			if not controller.is_running():
				print("FAIL: is_running() is false at 0.50s")
				all_ok = false
			
		# t = 1.00s
		elif abs(t - 1.00) < 0.0001:
			print("--- Checking t = 1.00s ---")
			print("Target position: ", target.position)
			print("Signal counts: a=%d b=%d c=%d done=%d" % [counts["a"], counts["b"], counts["c"], counts["done"]])
			print("is_running(): ", controller.is_running())
			
			if not target.position.is_equal_approx(Vector2(200, 100)):
				print("FAIL: Position at 1.00s is not approx (200, 100)")
				all_ok = false
			if counts["a"] != 1 or counts["b"] != 0 or counts["c"] != 0 or counts["done"] != 0:
				print("FAIL: Signal counts at 1.00s are not a=1 and others 0")
				all_ok = false
			if not controller.is_running():
				print("FAIL: is_running() is false at 1.00s")
				all_ok = false
			
		# t = 1.50s
		elif abs(t - 1.50) < 0.0001:
			print("--- Checking t = 1.50s ---")
			print("Target scale: ", target.scale, " modulate.a: ", target.modulate.a)
			print("Signal counts: a=%d b=%d c=%d done=%d" % [counts["a"], counts["b"], counts["c"], counts["done"]])
			print("is_running(): ", controller.is_running())
			
			if not target.scale.is_equal_approx(Vector2(1.5, 1.5)):
				print("FAIL: Scale at 1.50s is not approx (1.5, 1.5)")
				all_ok = false
			if not is_equal_approx(target.modulate.a, 0.75):
				print("FAIL: modulate.a at 1.50s is not approx 0.75")
				all_ok = false
			if counts["a"] != 1 or counts["b"] != 0 or counts["c"] != 0 or counts["done"] != 0:
				print("FAIL: Signal counts at 1.50s are not a=1 and others 0")
				all_ok = false
			if not controller.is_running():
				print("FAIL: is_running() is false at 1.50s")
				all_ok = false
			
		# t = 2.00s
		elif abs(t - 2.00) < 0.0001:
			print("--- Checking t = 2.00s ---")
			print("Target scale: ", target.scale, " modulate.a: ", target.modulate.a)
			print("Signal counts: a=%d b=%d c=%d done=%d" % [counts["a"], counts["b"], counts["c"], counts["done"]])
			print("is_running(): ", controller.is_running())
			
			if not target.scale.is_equal_approx(Vector2(2.0, 2.0)):
				print("FAIL: Scale at 2.00s is not approx (2, 2)")
				all_ok = false
			if not is_equal_approx(target.modulate.a, 0.5):
				print("FAIL: modulate.a at 2.00s is not approx 0.5")
				all_ok = false
			if counts["a"] != 1 or counts["b"] != 1 or counts["c"] != 0 or counts["done"] != 0:
				print("FAIL: Signal counts at 2.00s are not a=1, b=1, others 0")
				all_ok = false
			if not controller.is_running():
				print("FAIL: is_running() is false at 2.00s")
				all_ok = false
			
		# t = 3.00s
		elif abs(t - 3.00) < 0.0001:
			print("--- Checking t = 3.00s ---")
			print("Target rotation: ", target.rotation)
			print("Signal counts: a=%d b=%d c=%d done=%d" % [counts["a"], counts["b"], counts["c"], counts["done"]])
			print("is_running(): ", controller.is_running())
			
			if not is_equal_approx(target.rotation, PI/2):
				print("FAIL: Rotation at 3.00s is not approx PI/2")
				all_ok = false
			if counts["a"] != 1 or counts["b"] != 1 or counts["c"] != 1 or counts["done"] != 0:
				print("FAIL: Signal counts at 3.00s are not a=1, b=1, c=1, done=0")
				all_ok = false
			if not controller.is_running():
				print("FAIL: is_running() is false at 3.00s")
				all_ok = false
			
		# t = 3.50s
		elif abs(t - 3.50) < 0.0001:
			print("--- Checking t = 3.50s ---")
			print("Target modulate: ", target.modulate)
			print("Signal counts: a=%d b=%d c=%d done=%d" % [counts["a"], counts["b"], counts["c"], counts["done"]])
			print("is_running(): ", controller.is_running())
			
			# Modulate should be Color(0.5, 1.0, 1.0, 1.0)
			var expected_color = Color(0.5, 1.0, 1.0, 1.0)
			if not target.modulate.is_equal_approx(expected_color):
				print("FAIL: Modulate at 3.50s is not approx ", expected_color)
				all_ok = false
			if counts["a"] != 1 or counts["b"] != 1 or counts["c"] != 1 or counts["done"] != 1:
				print("FAIL: Signal counts at 3.50s are not all 1")
				all_ok = false
			if controller.is_running():
				print("FAIL: is_running() is true at 3.50s")
				all_ok = false
			
	print("==================================================")
	if all_ok:
		print("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!")
		print("==================================================")
		animator.queue_free()
		quit(0)
	else:
		print("SOME VERIFICATION CHECKS FAILED.")
		print("==================================================")
		animator.queue_free()
		quit(1)
