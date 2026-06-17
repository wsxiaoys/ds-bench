extends SceneTree

var _tests_passed: int = 0
var _tests_failed: int = 0
var _test_phase: int = 0
var _timer: float = 0.0
var _phase_done: bool = false
var _loader: Node = null

# Signal tracking
var _progress_received: bool = false
var _progress_fractions: Array[float] = []
var _load_completed_count: int = 0
var _load_failed_count: int = 0
var _last_fail_reason: String = ""
var _last_loaded_scene = null


func _init() -> void:
	call_deferred("_run_tests")


func _run_tests() -> void:
	_loader = get_root().get_node_or_null("SceneLoader")
	if _loader == null:
		print("FAIL: SceneLoader autoload not found")
		quit(1)
		return

	# Connect signals for tracking
	_loader.progress_updated.connect(_on_progress_updated)
	_loader.load_completed.connect(_on_load_completed)
	_loader.load_failed.connect(_on_load_failed)

	print("=== Running SceneLoader Tests ===")

	# Test 1: is_loading returns false initially
	_test("is_loading returns false initially", func():
		return not _loader.is_loading()
	)

	# Test 2: start_load returns true for valid path
	_test("start_load returns true for valid path", func():
		return _loader.start_load("res://scenes/HugeLevel.tscn")
	)

	# Test 3: is_loading returns true after start_load
	_test("is_loading returns true after start_load", func():
		return _loader.is_loading()
	)

	# Test 4: second start_load returns false while loading
	_test("second start_load returns false while loading", func():
		return not _loader.start_load("res://scenes/OtherScene.tscn")
	)

	# Now wait for load to complete
	_test_phase = 1
	_phase_done = false
	print("--- Waiting for async load to complete ---")


func _on_progress_updated(fraction: float) -> void:
	_progress_received = true
	_progress_fractions.append(fraction)


func _on_load_completed(scene) -> void:
	_load_completed_count += 1
	_last_loaded_scene = scene


func _on_load_failed(reason: String) -> void:
	_load_failed_count += 1
	_last_fail_reason = reason


func _test(name: String, condition: Callable) -> void:
	if condition.call():
		_tests_passed += 1
		print("  PASS: ", name)
	else:
		_tests_failed += 1
		print("FAIL: ", name)
		_quit_with_failure()


func _process(_delta: float) -> bool:
	if _test_phase == 1 and not _phase_done:
		if not _loader.is_loading():
			_phase_done = true
			print("--- Load completed, running post-load tests ---")

			# Test 5: is_loading returns false after load completes
			_test("is_loading returns false after load completes", func():
				return not _loader.is_loading()
			)

			# Test 6: progress_updated fired at least once
			_test("progress_updated fired at least once", func():
				return _progress_received
			)

			# Test 7: all progress fractions in [0, 1]
			_test("all progress fractions in [0.0, 1.0]", func():
				for f in _progress_fractions:
					if f < 0.0 or f > 1.0:
						return false
				return true
			)

			# Test 8: load_completed fired exactly once
			_test("load_completed fired exactly once", func():
				return _load_completed_count == 1
			)

			# Test 9: load_completed carries a PackedScene
			_test("load_completed carries a PackedScene", func():
				return _last_loaded_scene != null and _last_loaded_scene is PackedScene
			)

			# Test 10: instantiated scene has 50+ Node2D descendants
			if _last_loaded_scene != null and _last_loaded_scene is PackedScene:
				var instance: Node = _last_loaded_scene.instantiate()
				var count := _count_node2d_descendants(instance)
				if instance is Node2D:
					count += 1
				instance.queue_free()
				_test("instantiated scene has >=50 Node2D descendants", func():
					return count >= 50
				)
			else:
				_test("instantiated scene has >=50 Node2D descendants", func():
					return false
				)

			# Test 11: start_load of invalid path starts async fail
			var started: bool = _loader.start_load("res://does/not/exist.tscn")
			_test("start_load of invalid path returns true", func():
				return started
			)

			_test_phase = 2
			_phase_done = false
			_timer = 0.0
			_progress_received = false
			_progress_fractions.clear()
			_load_completed_count = 0
			_load_failed_count = 0

		return false

	if _test_phase == 2 and not _phase_done:
		_timer += _delta
		if not _loader.is_loading() or _timer > 2.0:
			_phase_done = true
			print("--- Invalid load resolved, running fail tests ---")

			# Test 12: load_failed fired for invalid path
			_test("load_failed fired for invalid path", func():
				return _load_failed_count >= 1
			)

			# Test 13: load_completed did NOT fire for invalid path
			_test("load_completed did NOT fire for invalid path", func():
				return _load_completed_count == 0
			)

			# Test 14: is_loading returns false after failed load
			_test("is_loading returns false after failed load", func():
				return not _loader.is_loading()
			)

			# Test 15: start_load succeeds again after fail
			_test("start_load succeeds after failed load", func():
				return _loader.start_load("res://scenes/HugeLevel.tscn")
			)

			# Test 16: cancel stops loading
			_loader.cancel()
			_test("is_loading returns false after cancel", func():
				return not _loader.is_loading()
			)

			# Test 17: start_load succeeds after cancel
			_test("start_load succeeds after cancel", func():
				return _loader.start_load("res://scenes/HugeLevel.tscn")
			)

			# Wait for final load
			_test_phase = 3
			_phase_done = false

		return false

	if _test_phase == 3 and not _phase_done:
		if not _loader.is_loading():
			_phase_done = true
			print("--- Final load completed ---")
			_print_summary()
			quit(0)

		return false

	return false


func _count_node2d_descendants(node: Node) -> int:
	var count := 0
	for child in node.get_children():
		if child is Node2D:
			count += 1
		count += _count_node2d_descendants(child)
	return count


func _print_summary() -> void:
	print("")
	if _tests_failed == 0:
		print("ALL TESTS PASSED")
	else:
		print("FAIL: ", _tests_failed, " test(s) failed out of ", _tests_passed + _tests_failed)
		quit(1)


func _quit_with_failure() -> void:
	print("")
	print("FAIL: Test suite aborted due to failure.")
	quit(1)
