extends SceneTree

var _failures: int = 0
var _completed_count: int = 0
var _failed_count: int = 0
var _progress_count: int = 0
var _last_failed_reason: String = ""
var _completed_scene = null

func _initialize() -> void:
	print("=== SceneLoader Test Harness ===")
	await _run_tests()

func _fail(msg: String) -> void:
	_failures += 1
	print("FAIL: " + msg)

func _ok(msg: String) -> void:
	print("OK: " + msg)

func _run_tests() -> void:
	await _test_REDACTEDload_exists()
	await _test_api_surface()
	await _test_huge_level_load()
	await _test_nonexistent_path()
	await _test_cancel_then_restart()
	await _test_huge_level_descendants()
	await _test_loading_screen()

	if _failures == 0:
		print("ALL TESTS PASSED")
		quit(0)
	else:
		quit(1)

func _test_REDACTEDload_exists() -> void:
	if root.has_node("SceneLoader"):
		_ok("SceneLoader REDACTEDload present")
	else:
		_fail("SceneLoader REDACTEDload not found in scene tree")
		return
	var node = root.get_node("SceneLoader")
	if node.get_script() != null:
		_ok("Autoload has script attached")
	else:
		_fail("Autoload has no script attached")

func _test_api_surface() -> void:
	var sl = root.get_node_or_null("SceneLoader")
	if sl == null:
		_fail("SceneLoader REDACTEDload missing for API check")
		return
	if sl.has_signal("progress_updated"):
		_ok("progress_updated signal exists")
	else:
		_fail("progress_updated signal missing")
	if sl.has_signal("load_completed"):
		_ok("load_completed signal exists")
	else:
		_fail("load_completed signal missing")
	if sl.has_signal("load_failed"):
		_ok("load_failed signal exists")
	else:
		_fail("load_failed signal missing")
	if sl.has_method("start_load"):
		_ok("start_load method exists")
	else:
		_fail("start_load method missing")
	if sl.has_method("cancel"):
		_ok("cancel method exists")
	else:
		_fail("cancel method missing")
	if sl.has_method("is_loading"):
		_ok("is_loading method exists")
	else:
		_fail("is_loading method missing")

func _reset_signal_counters() -> void:
	_completed_count = 0
	_failed_count = 0
	_progress_count = 0
	_last_failed_reason = ""
	_completed_scene = null

func _test_huge_level_load() -> void:
	_reset_signal_counters()
	var sl = root.get_node("SceneLoader")
	if sl.load_completed.is_connected(_on_completed):
		sl.load_completed.disconnect(_on_completed)
	if sl.load_failed.is_connected(_on_failed):
		sl.load_failed.disconnect(_on_failed)
	if sl.progress_updated.is_connected(_on_progress):
		sl.progress_updated.disconnect(_on_progress)
	sl.load_completed.connect(_on_completed)
	sl.load_failed.connect(_on_failed)
	sl.progress_updated.connect(_on_progress)

	var r1 = sl.start_load("res://scenes/HugeLevel.tscn")
	if r1 == true:
		_ok("start_load returned true on first call")
	else:
		_fail("start_load did not return true on first call")

	var r2 = sl.start_load("res://scenes/HugeLevel.tscn")
	if r2 == false:
		_ok("start_load returned false on second call while loading")
	else:
		_fail("start_load did not return false on second call")

	var t = 0.0
	while _completed_count == 0 and _failed_count == 0 and t < 30.0:
		await create_timer(0.1).timeout
		t += 0.1

	if _completed_count == 1:
		_ok("load_completed fired exactly once")
	else:
		_fail("load_completed fired " + str(_completed_count) + " times (expected 1)")

	if _progress_count >= 1:
		_ok("progress_updated fired at least once (" + str(_progress_count) + " times)")
	else:
		_fail("progress_updated did not fire")

	if _completed_scene != null and _completed_scene is PackedScene:
		_ok("load_completed payload is PackedScene")
	else:
		_fail("load_completed payload is not PackedScene")
		return

	var inst = _completed_scene.instantiate()
	var count = _count_node2d(inst)
	if count >= 50:
		_ok("Instantiated tree has " + str(count) + " Node2D descendants (>=50)")
	else:
		_fail("Instantiated tree has " + str(count) + " Node2D descendants (expected >=50)")
	inst.queue_free()

func _test_nonexistent_path() -> void:
	_reset_signal_counters()
	var sl = root.get_node("SceneLoader")
	if sl.load_failed.is_connected(_on_failed):
		sl.load_failed.disconnect(_on_failed)
	if sl.load_completed.is_connected(_on_completed):
		sl.load_completed.disconnect(_on_completed)
	sl.load_failed.connect(_on_failed)
	sl.load_completed.connect(_on_completed)

	var r = sl.start_load("res://does/not/exist.tscn")
	if r == true:
		_ok("start_load returned true for nonexistent path")
	else:
		_fail("start_load did not return true for nonexistent path")

	var t = 0.0
	while _failed_count == 0 and t < 1.0:
		await create_timer(0.05).timeout
		t += 0.05

	if _failed_count >= 1:
		_ok("load_failed fired within 1 second")
	else:
		_fail("load_failed did not fire within 1 second")

	if _completed_count == 0:
		_ok("load_completed did not fire for nonexistent path")
	else:
		_fail("load_completed fired for nonexistent path")

	if not sl.is_loading():
		_ok("is_loading() returns false after failed load")
	else:
		_fail("is_loading() returned true after failed load")

func _test_cancel_then_restart() -> void:
	_reset_signal_counters()
	var sl = root.get_node("SceneLoader")
	if sl.load_completed.is_connected(_on_completed):
		sl.load_completed.disconnect(_on_completed)
	sl.load_completed.connect(_on_completed)
	var r1 = sl.start_load("res://scenes/HugeLevel.tscn")
	if r1 == true:
		_ok("start_load for cancel test returned true")
	else:
		_fail("start_load for cancel test did not return true")
	sl.cancel()
	if sl.is_loading() == false:
		_ok("is_loading() returns false after cancel")
	else:
		_fail("is_loading() returned true after cancel")

	var r2 = sl.start_load("res://scenes/HugeLevel.tscn")
	if r2 == true:
		_ok("start_load returns true after cancel")
	else:
		_fail("start_load did not return true after cancel")
	await create_timer(0.05).timeout
	sl.cancel()

func _test_huge_level_descendants() -> void:
	var packed = load("res://scenes/HugeLevel.tscn")
	if packed == null:
		_fail("Could not load HugeLevel.tscn")
		return
	if not (packed is PackedScene):
		_fail("HugeLevel.tscn is not PackedScene")
		return
	var inst = packed.instantiate()
	var count = _count_node2d(inst)
	if count >= 50:
		_ok("HugeLevel.tscn direct instantiate has " + str(count) + " Node2D descendants")
	else:
		_fail("HugeLevel.tscn direct instantiate has " + str(count) + " Node2D descendants")
	inst.queue_free()

func _test_loading_screen() -> void:
	var packed = load("res://scenes/LoadingScreen.tscn")
	if packed == null:
		_fail("Could not load LoadingScreen.tscn")
		return
	if not (packed is PackedScene):
		_fail("LoadingScreen.tscn is not PackedScene")
		return
	var inst = packed.instantiate()
	if inst is Control:
		_ok("LoadingScreen root is Control")
	else:
		_fail("LoadingScreen root is not Control")
	if inst.has_node("ProgressBar"):
		_ok("LoadingScreen has ProgressBar")
	else:
		_fail("LoadingScreen missing ProgressBar")
	if inst.has_node("Label"):
		_ok("LoadingScreen has Label")
	else:
		_fail("LoadingScreen missing Label")
	inst.queue_free()

func _on_completed(scene) -> void:
	_completed_count += 1
	_completed_scene = scene

func _on_failed(reason: String) -> void:
	_failed_count += 1
	_last_failed_reason = reason

func _on_progress(fraction: float) -> void:
	_progress_count += 1
	if fraction < 0.0 or fraction > 1.0:
		_fail("progress_updated fraction out of range: " + str(fraction))

func _count_node2d(node: Node) -> int:
	var n = 0
	if node is Node2D:
		n += 1
	for child in node.get_children():
		n += _count_node2d(child)
	return n
