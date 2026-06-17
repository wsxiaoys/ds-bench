extends SceneTree

func _initialize() -> void:
	run_tests_async()

func run_tests_async() -> void:
	print("Starting SceneLoader tests...")
	
	# Get the SceneLoader autoload node from root
	var loader = root.get_node_or_null("SceneLoader")
	if not loader:
		# Fallback to manual instantiation if not present
		var loader_script = load("res://autoloads/SceneLoader.gd")
		if not loader_script:
			fail("Failed to load SceneLoader.gd script.")
			return
		loader = loader_script.new()
		loader.name = "SceneLoader"
		root.add_child(loader)
	
	# Wait for a frame to let the loader initialize
	await process_frame
	
	# -----------------------------------------------------------------
	# Test 1: Basic loading of a valid scene (res://scenes/HugeLevel.tscn)
	# -----------------------------------------------------------------
	print("Running Test 1: Basic loading of a valid scene...")
	
	var state = {
		"progress_signals": [],
		"completed_scene": null,
		"failed_reason": null
	}
	
	var progress_callback = func(fraction):
		print("Progress updated: ", fraction)
		state.progress_signals.append(fraction)
	
	var completed_callback = func(scene):
		print("Load completed! Scene: ", scene)
		state.completed_scene = scene
	
	var failed_callback = func(reason):
		print("Load failed! Reason: ", reason)
		state.failed_reason = reason
	
	loader.progress_updated.connect(progress_callback)
	loader.load_completed.connect(completed_callback)
	loader.load_failed.connect(failed_callback)
	
	var start_res = loader.start_load("res://scenes/HugeLevel.tscn")
	if not start_res:
		fail("Test 1: start_load returned false for a valid non-loading state.")
		return
	
	# A second call before the first finishes must return false
	var second_start_res = loader.start_load("res://scenes/HugeLevel.tscn")
	if second_start_res:
		fail("Test 1: second start_load call returned true while already loading.")
		return
	
	# Wait for load to complete or fail or timeout (5 seconds)
	var timeout = 5.0
	var elapsed = 0.0
	while elapsed < timeout and state.completed_scene == null and state.failed_reason == null:
		await process_frame
		elapsed += 1.0 / 60.0 # Approximate frame time
	
	if state.failed_reason != null:
		fail("Test 1: load failed with reason: " + state.failed_reason)
		return
	
	if state.completed_scene == null:
		fail("Test 1: load timed out after 5 seconds.")
		return
	
	# Verify progress updated signals
	if state.progress_signals.size() == 0:
		fail("Test 1: progress_updated was never emitted.")
		return
	
	for fraction in state.progress_signals:
		if fraction < 0.0 or fraction > 1.0:
			fail("Test 1: emitted progress fraction " + str(fraction) + " is out of bounds [0.0, 1.0].")
			return
	
	# Verify descendants count
	var inst: Node = state.completed_scene.instantiate()
	var descendant_count = count_node2d_descendants(inst)
	inst.free()
	
	print("Test 1: Descendant Node2D count = ", descendant_count)
	if descendant_count < 50:
		fail("Test 1: HugeLevel has " + str(descendant_count) + " Node2D descendants, expected at least 50.")
		return
	
	if loader.is_loading():
		fail("Test 1: loader.is_loading() returned true after load completed.")
		return
	
	# Disconnect test 1 callbacks
	loader.progress_updated.disconnect(progress_callback)
	loader.load_completed.disconnect(completed_callback)
	loader.load_failed.disconnect(failed_callback)
	
	# -----------------------------------------------------------------
	# Test 2: Loading of a non-existent scene (res://does/not/exist.tscn)
	# -----------------------------------------------------------------
	print("Running Test 2: Loading of a non-existent scene...")
	state.progress_signals.clear()
	state.completed_scene = null
	state.failed_reason = null
	
	loader.progress_updated.connect(progress_callback)
	loader.load_completed.connect(completed_callback)
	loader.load_failed.connect(failed_callback)
	
	start_res = loader.start_load("res://does/not/exist.tscn")
	if not start_res:
		fail("Test 2: start_load returned false for non-existent path.")
		return
	
	if not loader.is_loading():
		fail("Test 2: loader.is_loading() returned false immediately after start_load.")
		return
	
	# Wait for load_failed to fire (within 1 second)
	timeout = 1.0
	elapsed = 0.0
	while elapsed < timeout and state.failed_reason == null:
		await process_frame
		elapsed += 1.0 / 60.0
	
	if state.failed_reason == null:
		fail("Test 2: load_failed did not fire within 1 second for non-existent path.")
		return
	
	if state.completed_scene != null:
		fail("Test 2: load_completed fired for a non-existent path.")
		return
	
	if loader.is_loading():
		fail("Test 2: loader.is_loading() returned true after load failed.")
		return
	
	loader.progress_updated.disconnect(progress_callback)
	loader.load_completed.disconnect(completed_callback)
	loader.load_failed.disconnect(failed_callback)
	
	# -----------------------------------------------------------------
	# Test 3: Cancellation of a load
	# -----------------------------------------------------------------
	print("Running Test 3: Cancellation of a load...")
	state.progress_signals.clear()
	state.completed_scene = null
	state.failed_reason = null
	
	loader.progress_updated.connect(progress_callback)
	loader.load_completed.connect(completed_callback)
	loader.load_failed.connect(failed_callback)
	
	start_res = loader.start_load("res://scenes/HugeLevel.tscn")
	if not start_res:
		fail("Test 3: start_load returned false.")
		return
	
	if not loader.is_loading():
		fail("Test 3: loader.is_loading() returned false after start_load.")
		return
	
	loader.cancel()
	
	if loader.is_loading():
		fail("Test 3: loader.is_loading() returned true after cancel().")
		return
	
	# Wait a bit to ensure no signals are fired for the cancelled load
	elapsed = 0.0
	while elapsed < 0.5:
		await process_frame
		elapsed += 1.0 / 60.0
	
	if state.completed_scene != null or state.failed_reason != null:
		fail("Test 3: completed or failed signal fired after cancel().")
		return
	
	# A subsequent start_load of a valid path must return true
	start_res = loader.start_load("res://scenes/HugeLevel.tscn")
	if not start_res:
		fail("Test 3: start_load of valid path returned false after cancel.")
		return
	
	# Wait for it to complete
	timeout = 5.0
	elapsed = 0.0
	while elapsed < timeout and state.completed_scene == null and state.failed_reason == null:
		await process_frame
		elapsed += 1.0 / 60.0
	
	if state.completed_scene == null:
		fail("Test 3: subsequent load failed or timed out.")
		return
	
	loader.progress_updated.disconnect(progress_callback)
	loader.load_completed.disconnect(completed_callback)
	loader.load_failed.disconnect(failed_callback)
	
	# -----------------------------------------------------------------
	# Test 4: Verify LoadingScreen connects and works
	# -----------------------------------------------------------------
	print("Running Test 4: LoadingScreen verification...")
	var loading_screen_scene = load("res://scenes/LoadingScreen.tscn")
	if not loading_screen_scene:
		fail("Test 4: Failed to load LoadingScreen.tscn")
		return
	
	var loading_screen = loading_screen_scene.instantiate()
	root.add_child(loading_screen)
	
	# Verify it has ProgressBar and Label
	var progress_bar = loading_screen.get_node_or_null("ProgressBar")
	var label = loading_screen.get_node_or_null("Label")
	if not progress_bar or not (progress_bar is ProgressBar):
		fail("Test 4: LoadingScreen does not contain a ProgressBar node.")
		return
	if not label or not (label is Label):
		fail("Test 4: LoadingScreen does not contain a Label node.")
		return
	
	# Trigger a load to see if LoadingScreen updates its UI
	start_res = loader.start_load("res://scenes/HugeLevel.tscn")
	if not start_res:
		fail("Test 4: start_load returned false.")
		return
	
	# Wait for completion
	elapsed = 0.0
	while elapsed < 5.0 and loader.is_loading():
		await process_frame
		elapsed += 1.0 / 60.0
	
	# Check if label has updated
	if "Completed" not in label.text and "Loading" not in label.text:
		fail("Test 4: LoadingScreen Label text was not updated. Got: " + label.text)
		return
	
	loading_screen.queue_free()
	
	print("ALL TESTS PASSED")
	quit(0)

func fail(reason: String) -> void:
	print("FAIL: ", reason)
	quit(1)

func count_node2d_descendants(node: Node) -> int:
	var count = 0
	for child in node.get_children():
		if child is Node2D:
			count += 1
		count += count_node2d_descendants(child)
	return count
