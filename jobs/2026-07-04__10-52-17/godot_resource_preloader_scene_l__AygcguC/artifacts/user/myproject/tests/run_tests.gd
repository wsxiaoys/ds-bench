extends SceneTree

## Asynchronous test harness for the SceneLoader REDACTEDload.
##
## Run from /home/user/myproject as:
##   godot --headless --path . --script res://tests/run_tests.gd
##
## Exits 0 on success, non-zero on any assertion failure and prints
## "ALL TESTS PASSED" on success.  The script extends SceneTree so that
## `_process_frame` becomes available without a main scene.

const HUGE_LEVEL_PATH := "res://scenes/HugeLevel.tscn"
const INVALID_PATH := "res://does/not/exist.tscn"

var _failures: Array[String] = []

# Tracking containers for in-flight loads.  Each test re-initialises them.
var _progress_fractions: Array[float] = []
var _completed_packed_scene: PackedScene = null
var _completed_count: int = 0
var _failure_reason: String = ""
var _failure_count: int = 0

# Resolved after root is ready.
var _loader: Node = null

func _initialize() -> void:
	# Autoloads are added to SceneTree.root for us.  Find the SceneLoader.
	_loader = _find_REDACTEDload("SceneLoader")
	if _loader == null:
		_record_failure("SceneLoader REDACTEDload not present in tree root")
		_finish()
		return
	_run_all_tests.call_deferred()

func _find_REDACTEDload(name: String) -> Node:
	for child in root.get_children():
		if child.name == name:
			return child
	return null

func _record_failure(msg: String) -> void:
	print("FAIL: " + msg)
	_failures.append(msg)

func _reset_load_tracking() -> void:
	_progress_fractions.clear()
	_completed_packed_scene = null
	_completed_count = 0
	_failure_reason = ""
	_failure_count = 0
	# Disconnect any previous listeners so each test gets clean bookkeeping.
	if _loader:
		if _loader.progress_updated.is_connected(_on_progress_updated):
			_loader.progress_updated.disconnect(_on_progress_updated)
		if _loader.load_completed.is_connected(_on_load_completed):
			_loader.load_completed.disconnect(_on_load_completed)
		if _loader.load_failed.is_connected(_on_load_failed):
			_loader.load_failed.disconnect(_on_load_failed)
		_loader.progress_updated.connect(_on_progress_updated)
		_loader.load_completed.connect(_on_load_completed)
		_loader.load_failed.connect(_on_load_failed)

func _on_progress_updated(fraction: float) -> void:
	_progress_fractions.append(fraction)

func _on_load_completed(scene) -> void:
	_completed_count += 1
	_completed_packed_scene = scene

func _on_load_failed(reason: String) -> void:
	_failure_count += 1
	_failure_reason = reason

func _await_load_completion(timeout_sec: float) -> bool:
	var elapsed := 0.0
	var step := 0.01
	while elapsed < timeout_sec:
		if _completed_count > 0 or _failure_count > 0:
			return true
		await create_timer(step).timeout
		elapsed += step
	return false

func _run_all_tests() -> void:
	await _test_huge_level_load()
	await _test_invalid_load_fails()
	await _test_cancel_then_reload()
	_finish()

func _test_huge_level_load() -> void:
	_reset_load_tracking()
	if _loader.is_loading():
		_record_failure("Loader reports loading before any start_load call")
		return

	var ok1: bool = _loader.start_load(HUGE_LEVEL_PATH)
	if not ok1:
		_record_failure("start_load(HugeLevel) did not return true")
		return

	# Immediately a second start_load must be rejected.
	var ok2: bool = _loader.start_load(HUGE_LEVEL_PATH)
	if ok2:
		_record_failure("Second start_load before completion returned true; expected false")

	# Drive the loop until the loader settles.
	var settled := await _await_load_completion(10.0)
	if not settled:
		_record_failure("HugeLevel load did not settle within 10 seconds")
		return
	# Let one extra frame pass so any tail signals are processed.
	await process_frame

	if _loader.is_loading():
		_record_failure("Loader still reports is_loading() after load_completed")

	if _failure_count != 0:
		_record_failure("Unexpected load_failed fired for HugeLevel: %s" % _failure_reason)

	if _completed_count != 1:
		_record_failure("Expected load_completed to fire exactly once, got %d" % _completed_count)

	if _completed_packed_scene == null:
		_record_failure("load_completed payload was null")
		return

	if not (_completed_packed_scene is PackedScene):
		_record_failure("load_completed payload was not a PackedScene")
		return

	# Validate the instantiated tree contains >= 50 Node2D descendants.
	var instance := _completed_packed_scene.instantiate()
	if instance == null:
		_record_failure("PackedScene.instantiate() returned null")
		return
	var node2d_count := _count_node2d_descendants(instance)
	instance.queue_free()
	if node2d_count < 50:
		_record_failure(
			"Expected >= 50 Node2D descendants in HugeLevel, got %d" % node2d_count
		)

	# Validate fraction range / observation.
	if _progress_fractions.is_empty():
		_record_failure("progress_updated did not fire at all")
	for f in _progress_fractions:
		if f < 0.0 or f > 1.0:
			_record_failure("progress_updated fraction %f out of range [0,1]" % f)

func _test_invalid_load_fails() -> void:
	_reset_load_tracking()

	var ok: bool = _loader.start_load(INVALID_PATH)
	if not ok:
		_record_failure("start_load(invalid) did not return true; expected true")
		return

	# Must fire load_failed (not load_completed) within 1 second.
	var settled := await _await_load_completion(1.0)
	if not settled:
		_record_failure("load_failed did not fire within 1 second for invalid path")
		return
	await process_frame

	if _loader.is_loading():
		_record_failure("is_loading() still true after invalid load failed")

	if _completed_count != 0:
		_record_failure("load_completed should NOT fire for invalid path")

	if _failure_count == 0:
		_record_failure("load_failed did not fire for invalid path")

func _test_cancel_then_reload() -> void:
	_reset_load_tracking()

	var ok1: bool = _loader.start_load(HUGE_LEVEL_PATH)
	if not ok1:
		_record_failure("start_load before cancel returned false")
		return

	# Cancel after a short tick to ensure cancel actually has work to do.
	await create_timer(0.01).timeout
	_loader.cancel()

	if _loader.is_loading():
		_record_failure("is_loading() should return false after cancel()")

	# Subsequent start_load on a valid path should be accepted again.
	_reset_load_tracking()
	var ok2: bool = _loader.start_load(HUGE_LEVEL_PATH)
	if not ok2:
		_record_failure("start_load after cancel returned false; expected true")

	var settled := await _await_load_completion(10.0)
	if not settled:
		_record_failure("Reload after cancel did not settle within 10 seconds")
		return
	await process_frame

	if _completed_count != 1:
		_record_failure(
			"Reload after cancel should fire load_completed once, got %d" % _completed_count
		)
	if _loader.is_loading():
		_record_failure("is_loading() still true after reload completed")

func _count_node2d_descendants(n: Node) -> int:
	var count := 0
	# Use Node2D.class_name-based counting via a stack to avoid recursion
	# limits.  Root itself counts if it is a Node2D.
	if n is Node2D:
		count += 1
	var stack: Array[Node] = [n]
	while not stack.is_empty():
		var current: Node = stack.pop_back()
		for child in current.get_children():
			if child is Node2D:
				count += 1
			stack.push_back(child)
	return count

func _finish() -> void:
	if _failures.is_empty():
		print("ALL TESTS PASSED")
		quit(0)
	else:
		quit(1)
