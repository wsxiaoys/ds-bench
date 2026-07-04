extends SceneTree

const HUGE_LEVEL_PATH = "res://scenes/HugeLevel.tscn"
const BAD_PATH = "res://does/not/exist.tscn"

var failures: int = 0
var signals_log: Array = []

func _on_progress(f) -> void:
	signals_log.append(["progress_updated", f])
	if not (f >= 0.0 and f <= 1.0):
		_fail("progress fraction out of range: %f" % f)

func _on_completed(scene) -> void:
	signals_log.append(["load_completed", scene])
	if scene == null:
		_fail("load_completed null scene")
		return
	if not (scene is PackedScene):
		_fail("load_completed not PackedScene: %s" % typeof(scene))
		return
	var inst: Node = scene.instantiate()
	if inst == null:
		_fail("instantiate returned null")
		return
	var n: int = _count_descendants(inst, "Node2D")
	if n < 50:
		_fail("expected >= 50 Node2D descendants, got %d" % n)
	inst.free()

func _on_failed(reason) -> void:
	signals_log.append(["load_failed", str(reason)])

func _count_descendants(n: Node, type_name: String) -> int:
	var c: int = 0
	for child in n.get_children():
		if child.is_class(type_name) or child.get_class() == type_name:
			c += 1
		c += _count_descendants(child, type_name)
	return c

func _fail(msg: String) -> void:
	failures += 1
	print("FAIL: " + msg)

func _initialize() -> void:
	await _run()
	if failures == 0:
		print("ALL TESTS PASSED")
	quit(0 if failures == 0 else 1)

func _run() -> void:
	var loader: Node = root.get_node_or_null("SceneLoader")
	if loader == null:
		_fail("SceneLoader REDACTEDload missing")
		quit(1)
		return
	if not loader.has_method("start_load"):
		_fail("start_load method missing")
	if not loader.has_method("cancel"):
		_fail("cancel method missing")
	if not loader.has_method("is_loading"):
		_fail("is_loading method missing")
	for s in ["progress_updated", "load_completed", "load_failed"]:
		if not loader.has_signal(s):
			_fail("signal missing: " + s)
	loader.connect("progress_updated", _on_progress)
	loader.connect("load_completed", _on_completed)
	loader.connect("load_failed", _on_failed)

	# Test 1: valid path returns true
	var ok1: bool = loader.call("start_load", HUGE_LEVEL_PATH)
	if not ok1:
		_fail("start_load on valid path returned false")

	# Test 2: second call returns false
	var ok2: bool = loader.call("start_load", HUGE_LEVEL_PATH)
	if ok2:
		_fail("second start_load should return false while loading")

	# Wait for completion
	var elapsed: int = 0
	while elapsed < 5000 and not _signal_fired("load_completed"):
		await create_timer(0.05).timeout
		elapsed += 50

	if not _signal_fired("load_completed"):
		_fail("load_completed did not fire within 5s")
	else:
		if loader.call("is_loading"):
			_fail("is_loading true after completion")

	var prog_count: int = _signal_count("progress_updated")
	if prog_count < 1:
		_fail("progress_updated did not fire at least once")

	# Test 3: invalid path -> load_failed within 1s
	signals_log.clear()
	var ok3: bool = loader.call("start_load", BAD_PATH)
	if not ok3:
		_fail("start_load on invalid path returned false")
	var t0: int = Time.get_ticks_msec()
	while not _signal_fired("load_failed") and (Time.get_ticks_msec() - t0) < 1500:
		await create_timer(0.05).timeout
	if not _signal_fired("load_failed"):
		_fail("load_failed did not fire within 1.5s for invalid path")
	if _signal_fired("load_completed"):
		_fail("load_completed fired for invalid path")
	if loader.call("is_loading"):
		_fail("is_loading true after failed load")

	# Test 4: cancel + restart
	signals_log.clear()
	var ok4: bool = loader.call("start_load", HUGE_LEVEL_PATH)
	if not ok4:
		_fail("start_load valid path returned false (pre-cancel)")
	loader.call("cancel")
	if loader.call("is_loading"):
		_fail("is_loading true after cancel")
	await create_timer(0.05).timeout
	var ok4b: bool = loader.call("start_load", HUGE_LEVEL_PATH)
	if not ok4b:
		_fail("start_load after cancel did not return true")
	loader.call("cancel")

	print("Signal events: %d" % signals_log.size())

func _signal_fired(name: String) -> bool:
	for entry in signals_log:
		if entry[0] == name:
			return true
	return false

func _signal_count(name: String) -> int:
	var c: int = 0
	for entry in signals_log:
		if entry[0] == name:
			c += 1
	return c
