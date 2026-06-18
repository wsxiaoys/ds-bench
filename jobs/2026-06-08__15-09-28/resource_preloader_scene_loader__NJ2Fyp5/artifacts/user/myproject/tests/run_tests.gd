## run_tests.gd
## Invocation: godot --headless --path . --script res://tests/run_tests.gd
## Exit 0  + prints "ALL TESTS PASSED" on success.
## Exit 1  + prints lines starting with "FAIL:" on any failure.

extends SceneTree

# ── signal-capture helper ─────────────────────────────────────────────────────

## Wraps a received signal so _await_signal can detect it.
class SignalCapture:
	var fired: bool = false
	var args: Array = []

	func _on_1(a) -> void:
		fired = true
		args = [a]

# ── test state ─────────────────────────────────────────────────────────────────

var _fail_count: int = 0
var _sl: Node  # The SceneLoader autoload instance.

func _fail(msg: String) -> void:
	_fail_count += 1
	print("FAIL: " + msg)


func _assert(condition: bool, msg: String) -> void:
	if not condition:
		_fail(msg)


## Wait up to *timeout_sec* seconds for signal *sig_name* (exactly 1 arg) on *obj*.
## Returns the captured SignalCapture (check .fired).
func _await_signal(obj: Object, sig_name: String, timeout_sec: float) -> SignalCapture:
	var cap := SignalCapture.new()
	obj.connect(sig_name, cap._on_1, CONNECT_ONE_SHOT)

	var deadline_ms: int = Time.get_ticks_msec() + int(timeout_sec * 1000.0)
	while not cap.fired and Time.get_ticks_msec() < deadline_ms:
		await process_frame

	if not cap.fired and obj.is_connected(sig_name, cap._on_1):
		obj.disconnect(sig_name, cap._on_1)

	return cap


## Count all Node2D descendants recursively.
func _count_node2d(node: Node) -> int:
	var total: int = 0
	for child in node.get_children():
		if child is Node2D:
			total += 1
		total += _count_node2d(child)
	return total

# ── test cases ─────────────────────────────────────────────────────────────────

func _test_double_start_returns_false() -> void:
	print("  start_load #1 ...")
	var ok1: bool = _sl.start_load("res://scenes/HugeLevel.tscn")
	_assert(ok1, "T1: first start_load should return true")

	print("  start_load #2 (should be false) ...")
	var ok2: bool = _sl.start_load("res://scenes/HugeLevel.tscn")
	_assert(not ok2, "T1: second start_load while loading should return false")

	_sl.cancel()
	await process_frame
	_assert(not _sl.is_loading(), "T1: is_loading() should be false after cancel()")


func _test_successful_load() -> void:
	var fractions: Array[float] = []

	var progress_cb := func(f: float) -> void:
		fractions.append(f)
	_sl.progress_updated.connect(progress_cb)

	_sl.start_load("res://scenes/HugeLevel.tscn")
	_assert(_sl.is_loading(), "T2: is_loading() should be true right after start_load")

	var cap: SignalCapture = await _await_signal(_sl, "load_completed", 10.0)

	_sl.progress_updated.disconnect(progress_cb)

	if not cap.fired:
		_fail("T2: load_completed did not fire within 10 s")
		return

	_assert(fractions.size() >= 1,
		"T2: at least one progress_updated must fire (got %d)" % fractions.size())

	for f in fractions:
		_assert(f >= 0.0 and f <= 1.0,
			"T2: progress fraction out of range: %f" % f)

	var scene = cap.args[0] if cap.args.size() > 0 else null
	_assert(scene != null, "T2: load_completed arg must not be null")
	_assert(scene is PackedScene, "T2: load_completed arg must be a PackedScene")

	if scene is PackedScene:
		var instance: Node = scene.instantiate()
		var count: int = _count_node2d(instance)
		_assert(count >= 50,
			"T2: HugeLevel must have >= 50 Node2D descendants, found %d" % count)
		instance.free()

	_assert(not _sl.is_loading(), "T2: is_loading() should be false after successful load")


func _test_failed_load() -> void:
	var completed_cap := SignalCapture.new()
	_sl.load_completed.connect(completed_cap._on_1, CONNECT_ONE_SHOT)

	_sl.start_load("res://does/not/exist.tscn")

	var fail_cap: SignalCapture = await _await_signal(_sl, "load_failed", 1.0)

	if _sl.load_completed.is_connected(completed_cap._on_1):
		_sl.load_completed.disconnect(completed_cap._on_1)

	_assert(fail_cap.fired, "T3: load_failed must fire within 1 s for a missing path")
	_assert(not completed_cap.fired, "T3: load_completed must NOT fire for a missing path")
	_assert(not _sl.is_loading(), "T3: is_loading() must be false after failure")


func _test_cancel_then_reload() -> void:
	_sl.start_load("res://scenes/HugeLevel.tscn")
	await process_frame
	_sl.cancel()

	_assert(not _sl.is_loading(), "T4: is_loading() must be false after cancel()")

	var ok: bool = _sl.start_load("res://scenes/HugeLevel.tscn")
	_assert(ok, "T4: start_load must return true after cancel()")

	# Wait for this load to complete so we leave state clean.
	await _await_signal(_sl, "load_completed", 10.0)

# ── entry point ────────────────────────────────────────────────────────────────

func _initialize() -> void:
	await process_frame   # Let autoloads fully initialise.

	# Autoloads are children of the root viewport, not engine singletons.
	_sl = root.get_node_or_null("SceneLoader")
	if _sl == null:
		print("FAIL: SceneLoader autoload not found as root child")
		quit(1)
		return

	print("Running test T1: double start_load returns false...")
	await _test_double_start_returns_false()

	print("Running test T2: successful load...")
	await _test_successful_load()

	print("Running test T3: failed load (missing path)...")
	await _test_failed_load()

	print("Running test T4: cancel then reload...")
	await _test_cancel_then_reload()

	if _fail_count == 0:
		print("ALL TESTS PASSED")
		quit(0)
	else:
		print("FAILED: %d test(s) failed." % _fail_count)
		quit(1)
