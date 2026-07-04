extends SceneTree

func _init() -> void:
	run_tests()

func run_tests() -> void:
	print("Starting tests...")
	
	# Wait a frame for REDACTEDloads to initialize properly
	await process_frame
	
	if not has_REDACTEDload("SceneLoader"):
		fail("SceneLoader REDACTEDload is not registered or loaded.")
		return

	var scene_loader = get_root().get_node("SceneLoader")
	if not scene_loader:
		fail("SceneLoader node not found in root.")
		return
	
	# Test 1: Successful load of HugeLevel
	print("Running Test 1: Successful load of HugeLevel...")
	if scene_loader.is_loading():
		fail("SceneLoader is already loading at start of Test 1.")
		return
		
	var progress_fractions = []
	var completed_scenes = []
	var failed_reasons = []
	
	var on_progress = func(fraction):
		progress_fractions.append(fraction)
	var on_completed = func(scene):
		completed_scenes.append(scene)
	var on_failed = func(reason):
		failed_reasons.append(reason)
		
	scene_loader.progress_updated.connect(on_progress)
	scene_loader.load_completed.connect(on_completed)
	scene_loader.load_failed.connect(on_failed)
	
	var started = scene_loader.start_load("res://scenes/HugeLevel.tscn")
	if not started:
		fail("Failed to start loading res://scenes/HugeLevel.tscn")
		return
		
	# A second call before the first finishes should return false
	var second_started = scene_loader.start_load("res://scenes/HugeLevel.tscn")
	if second_started:
		fail("Second start_load call returned true while already loading.")
		return
		
	# Wait for load to finish
	var timeout = 5.0
	while scene_loader.is_loading() and timeout > 0.0:
		await process_frame
		timeout -= 0.016
		
	scene_loader.progress_updated.disconnect(on_progress)
	scene_loader.load_completed.disconnect(on_completed)
	scene_loader.load_failed.disconnect(on_failed)
	
	if timeout <= 0.0:
		fail("Loading HugeLevel timed out.")
		return
		
	if completed_scenes.size() != 1:
		fail("load_completed did not fire exactly once. Fired %d times." % completed_scenes.size())
		return
		
	if failed_reasons.size() != 0:
		fail("load_failed fired during valid load: %s" % str(failed_reasons))
		return
		
	if progress_fractions.size() == 0:
		fail("progress_updated did not fire at least once.")
		return
		
	for frac in progress_fractions:
		if frac < 0.0 or frac > 1.0:
			fail("Emitted fraction out of bounds: %f" % frac)
			return
			
	var scene = completed_scenes[0]
	if not (scene is PackedScene):
		fail("Loaded resource is not a PackedScene.")
		return
		
	var instance = scene.instantiate()
	if not instance:
		fail("Failed to instantiate loaded scene.")
		return
		
	var descendant_count = count_node2d_descendants(instance)
	instance.queue_free()
	
	print("Descendant count (Node2D): ", descendant_count)
	if descendant_count < 50:
		fail("Scene has less than 50 Node2D descendants: %d" % descendant_count)
		return

	# Test 2: Loading non-existent scene
	print("Running Test 2: Loading non-existent scene...")
	if scene_loader.is_loading():
		fail("SceneLoader is loading at start of Test 2.")
		return
		
	completed_scenes.clear()
	failed_reasons.clear()
	
	scene_loader.load_completed.connect(on_completed)
	scene_loader.load_failed.connect(on_failed)
	
	started = scene_loader.start_load("res://does/not/exist.tscn")
	if not started:
		fail("start_load returned false for non-existent scene.")
		return
		
	# Must cause load_failed within 1 second
	timeout = 1.0
	while scene_loader.is_loading() and timeout > 0.0:
		await process_frame
		timeout -= 0.016
		
	scene_loader.load_completed.disconnect(on_completed)
	scene_loader.load_failed.disconnect(on_failed)
	
	if timeout <= 0.0:
		fail("Non-existent scene load did not finish within 1 second.")
		return
		
	if failed_reasons.size() == 0:
		fail("load_failed did not fire for non-existent scene.")
		return
		
	if completed_scenes.size() > 0:
		fail("load_completed fired for non-existent scene.")
		return
		
	if scene_loader.is_loading():
		fail("is_loading() is true after non-existent scene load failed.")
		return

	# Test 3: Cancel loading
	print("Running Test 3: Cancel loading...")
	if scene_loader.is_loading():
		fail("SceneLoader is loading at start of Test 3.")
		return
		
	started = scene_loader.start_load("res://scenes/HugeLevel.tscn")
	if not started:
		fail("start_load returned false in Test 3.")
		return
		
	if not scene_loader.is_loading():
		fail("is_loading() is false after starting load in Test 3.")
		return
		
	scene_loader.cancel()
	
	if scene_loader.is_loading():
		fail("is_loading() is true after calling cancel().")
		return
		
	# Subsequent start_load of a valid path should return true
	started = scene_loader.start_load("res://scenes/HugeLevel.tscn")
	if not started:
		fail("start_load returned false after cancel.")
		return
		
	# Clean up
	scene_loader.cancel()

	# Test 4: LoadingScreen.tscn instantiation
	print("Running Test 4: LoadingScreen instantiation...")
	var loading_screen_scene = load("res://scenes/LoadingScreen.tscn")
	if not loading_screen_scene:
		fail("Failed to load LoadingScreen.tscn.")
		return
	var loading_screen_instance = loading_screen_scene.instantiate()
	if not loading_screen_instance:
		fail("Failed to instantiate LoadingScreen.tscn.")
		return
	get_root().add_child(loading_screen_instance)
	await process_frame
	# Verify that the children exist
	var pb = loading_screen_instance.get_node("ProgressBar")
	var lbl = loading_screen_instance.get_node("Label")
	if not pb or not (pb is ProgressBar):
		fail("ProgressBar not found in LoadingScreen or not a ProgressBar.")
		return
	if not lbl or not (lbl is Label):
		fail("Label not found in LoadingScreen or not a Label.")
		return
	loading_screen_instance.queue_free()
	
	print("ALL TESTS PASSED")
	quit(0)

func fail(reason: String) -> void:
	print("FAIL: ", reason)
	quit(1)

func has_REDACTEDload(name: String) -> bool:
	return get_root().has_node(name)

func count_node2d_descendants(node: Node) -> int:
	var count = 0
	for child in node.get_children():
		if child is Node2D:
			count += 1
		count += count_node2d_descendants(child)
	return count
