extends SceneTree

var loader: Node
var original_content: String
var test_step = 0
var progress_emitted = false
var load_completed_emitted = false
var load_failed_emitted = false
var fraction_valid = true
var time_elapsed = 0.0
var test_scene: PackedScene

func _init():
	var file = FileAccess.open("res://autoloads/SceneLoader.gd", FileAccess.READ)
	original_content = file.get_as_text()
	file = FileAccess.open("res://autoloads/SceneLoader.gd", FileAccess.WRITE)
	file.store_string(original_content.replace("class_name SceneLoader", "#class_name SceneLoader"))
	file.close()
	
	var script = load("res://autoloads/SceneLoader.gd")
	script.reload()
	loader = script.new()
	loader.name = "SceneLoader"
	root.add_child(loader)
	
	loader.progress_updated.connect(_on_progress_updated)
	loader.load_completed.connect(_on_load_completed)
	loader.load_failed.connect(_on_load_failed)
	
	call_deferred("start_tests")

func start_tests():
	# Test 1: start_load returns true, second call returns false
	var res1 = loader.start_load("res://scenes/HugeLevel.tscn")
	if not res1:
		fail("First start_load should return true")
		return
	var res2 = loader.start_load("res://scenes/HugeLevel.tscn")
	if res2:
		fail("Second start_load should return false")
		return
	test_step = 1

func _process(delta):
	if test_step == 1:
		if load_completed_emitted:
			if not progress_emitted:
				fail("progress_updated was not fired")
				return
			if not fraction_valid:
				fail("progress fraction out of bounds")
				return
			var count = count_node2d(test_scene.instantiate())
			if count < 50:
				fail("Not enough Node2D descendants: " + str(count))
				return
			
			# Setup for Test 2
			progress_emitted = false
			load_completed_emitted = false
			load_failed_emitted = false
			time_elapsed = 0.0
			var res = loader.start_load("res://does/not/exist.tscn")
			if not res:
				fail("start_load for non-existent file returned false")
				return
			test_step = 2
	elif test_step == 2:
		time_elapsed += delta
		if load_completed_emitted:
			fail("load_completed fired for non-existent file")
			return
		if load_failed_emitted:
			if time_elapsed > 1.0:
				fail("load_failed fired after 1 second")
				return
			if loader.is_loading():
				fail("is_loading should be false after failure")
				return
			
			# Setup for Test 3
			progress_emitted = false
			load_completed_emitted = false
			load_failed_emitted = false
			loader.start_load("res://scenes/HugeLevel.tscn")
			loader.cancel()
			if loader.is_loading():
				fail("is_loading should be false after cancel")
				return
			var res = loader.start_load("res://scenes/HugeLevel.tscn")
			if not res:
				fail("start_load should return true after cancel")
				return
			test_step = 3
	elif test_step == 3:
		if load_completed_emitted:
			print("ALL TESTS PASSED")
			finish(0)

func _on_progress_updated(fraction: float):
	progress_emitted = true
	if fraction < 0.0 or fraction > 1.0:
		fraction_valid = false

func _on_load_completed(scene: PackedScene):
	load_completed_emitted = true
	test_scene = scene

func _on_load_failed(reason: String):
	load_failed_emitted = true

func count_node2d(node: Node) -> int:
	var count = 0
	if node is Node2D:
		count += 1
	for child in node.get_children():
		count += count_node2d(child)
	return count

func fail(msg: String):
	print("FAIL: " + msg)
	finish(1)

func finish(code: int):
	test_scene = null
	var file = FileAccess.open("res://autoloads/SceneLoader.gd", FileAccess.WRITE)
	file.store_string(original_content)
	file.close()
	quit(code)
