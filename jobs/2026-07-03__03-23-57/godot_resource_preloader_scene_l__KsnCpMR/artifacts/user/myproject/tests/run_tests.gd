extends SceneTree

func _init() -> void:
	run_tests.call_deferred()

func fail_test(msg: String) -> void:
	print("FAIL: ", msg)
	quit(1)

func run_tests() -> void:
	var scene_loader = root.get_node_or_null("SceneLoader")
	if not scene_loader:
		fail_test("SceneLoader REDACTEDload not found at /root/SceneLoader")
		return

	# Trackers using a dictionary to allow mutation inside lambdas
	var trackers = {
		"progress_signals": [],
		"load_completed_scene": null,
		"load_failed_reason": ""
	}

	scene_loader.progress_updated.connect(func(fraction: float):
		trackers["progress_signals"].append(fraction)
	)
	scene_loader.load_completed.connect(func(scene: PackedScene):
		trackers["load_completed_scene"] = scene
	)
	scene_loader.load_failed.connect(func(reason: String):
		trackers["load_failed_reason"] = reason
	)

	# --- TEST 1: Load HugeLevel successfully ---
	var started = scene_loader.start_load("res://scenes/HugeLevel.tscn")
	if not started:
		fail_test("start_load failed to return true on first call")
		return

	# A second call before the first finishes should return false
	var second_started = scene_loader.start_load("res://scenes/HugeLevel.tscn")
	if second_started:
		fail_test("start_load returned true on second concurrent call")
		return

	# Wait for loading to finish
	var start_time = Time.get_ticks_msec()
	var max_wait_ms = 5000
	while scene_loader.is_loading():
		if Time.get_ticks_msec() - start_time > max_wait_ms:
			fail_test("Loading timed out")
			return
		await process_frame

	# Verify progress signals
	if trackers["progress_signals"].size() == 0:
		fail_test("No progress_updated signal fired during successful load")
		return

	for fraction in trackers["progress_signals"]:
		if fraction < 0.0 or fraction > 1.0:
			fail_test("Progress fraction out of bounds [0, 1]: " + str(fraction))
			return

	# Verify load_completed carried the correct PackedScene
	if trackers["load_completed_scene"] == null:
		fail_test("load_completed did not fire, or didn't carry a PackedScene")
		return

	if not (trackers["load_completed_scene"] is PackedScene):
		fail_test("load_completed carried an object that is not a PackedScene")
		return

	var instance = trackers["load_completed_scene"].instantiate()
	if not instance:
		fail_test("Failed to instantiate the loaded PackedScene")
		return

	# Count Node2D descendants recursively
	var descendants_count = count_node2d_descendants(instance)
	# Subtract 1 if we want to exclude the root node itself
	if instance is Node2D:
		descendants_count -= 1

	instance.free()

	if descendants_count < 50:
		fail_test("Loaded scene has fewer than 50 Node2D descendants: " + str(descendants_count))
		return

	if trackers["load_failed_reason"] != "":
		fail_test("load_failed fired on successful load with reason: " + trackers["load_failed_reason"])
		return


	# --- TEST 2: Load non-existent path ---
	trackers["progress_signals"].clear()
	trackers["load_completed_scene"] = null
	trackers["load_failed_reason"] = ""

	var fail_started = scene_loader.start_load("res://does/not/exist.tscn")
	if not fail_started:
		fail_test("start_load on non-existent file returned false")
		return

	var fail_start_time = Time.get_ticks_msec()
	var fail_timeout_ms = 1000

	while scene_loader.is_loading():
		if Time.get_ticks_msec() - fail_start_time > fail_timeout_ms:
			fail_test("load_failed did not fire within 1 second for non-existent path")
			return
		await process_frame

	# Wait an extra frame to ensure deferred call finishes
	await process_frame

	if trackers["load_failed_reason"] == "":
		fail_test("load_failed did not fire for non-existent path")
		return

	if trackers["load_completed_scene"] != null:
		fail_test("load_completed fired for non-existent path")
		return

	if scene_loader.is_loading():
		fail_test("is_loading() returned true after load failure")
		return


	# --- TEST 3: Cancel loading ---
	trackers["progress_signals"].clear()
	trackers["load_completed_scene"] = null
	trackers["load_failed_reason"] = ""

	var cancel_started = scene_loader.start_load("res://scenes/HugeLevel.tscn")
	if not cancel_started:
		fail_test("start_load returned false when trying to test cancel")
		return

	if not scene_loader.is_loading():
		fail_test("is_loading() is false immediately after start_load")
		return

	scene_loader.cancel()

	if scene_loader.is_loading():
		fail_test("is_loading() is still true after cancel()")
		return

	# Wait a few frames to make sure no signals are fired
	for i in range(10):
		await process_frame

	if trackers["load_completed_scene"] != null:
		fail_test("load_completed fired after load was canceled")
		return

	if trackers["load_failed_reason"] != "":
		fail_test("load_failed fired after load was canceled")
		return

	# A subsequent start_load of a valid path should return true
	var subsequent_started = scene_loader.start_load("res://scenes/HugeLevel.tscn")
	if not subsequent_started:
		fail_test("subsequent start_load after cancel returned false")
		return

	# Wait for it to finish to leave the loader clean
	while scene_loader.is_loading():
		await process_frame


	# --- TEST 4: LoadingScreen.tscn existence and structure ---
	var loading_screen_packed = load("res://scenes/LoadingScreen.tscn")
	if not loading_screen_packed:
		fail_test("LoadingScreen.tscn could not be loaded")
		return

	var loading_screen = loading_screen_packed.instantiate()
	if not loading_screen:
		fail_test("LoadingScreen.tscn could not be instantiated")
		return

	if not (loading_screen is Control):
		fail_test("LoadingScreen root is not a Control node")
		return

	var progress_bar = loading_screen.get_node_or_null("ProgressBar")
	if not progress_bar or not (progress_bar is ProgressBar):
		fail_test("LoadingScreen does not contain a ProgressBar named ProgressBar")
		return

	var label = loading_screen.get_node_or_null("Label")
	if not label or not (label is Label):
		fail_test("LoadingScreen does not contain a Label named Label")
		return

	root.add_child(loading_screen)
	await process_frame

	# Check connections
	var progress_conns = scene_loader.progress_updated.get_connections()
	var completed_conns = scene_loader.load_completed.get_connections()
	var failed_conns = scene_loader.load_failed.get_connections()

	var progress_connected = false
	for conn in progress_conns:
		if conn.callable.get_object() == loading_screen:
			progress_connected = true
			break

	var completed_connected = false
	for conn in completed_conns:
		if conn.callable.get_object() == loading_screen:
			completed_connected = true
			break

	var failed_connected = false
	for conn in failed_conns:
		if conn.callable.get_object() == loading_screen:
			failed_connected = true
			break

	root.remove_child(loading_screen)
	loading_screen.free()

	if not progress_connected:
		fail_test("LoadingScreen script did not connect to SceneLoader.progress_updated")
		return

	if not completed_connected:
		fail_test("LoadingScreen script did not connect to SceneLoader.load_completed")
		return

	if not failed_connected:
		fail_test("LoadingScreen script did not connect to SceneLoader.load_failed")
		return

	print("ALL TESTS PASSED")
	quit(0)

func count_node2d_descendants(node: Node) -> int:
	var count = 0
	if node is Node2D:
		count += 1
	for child in node.get_children():
		count += count_node2d_descendants(child)
	return count
