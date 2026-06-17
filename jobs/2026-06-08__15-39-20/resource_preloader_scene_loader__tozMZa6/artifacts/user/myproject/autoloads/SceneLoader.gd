extends Node
class_name SceneLoader

signal progress_updated(fraction: float)
signal load_completed(scene: PackedScene)
signal load_failed(reason: String)

var _is_loading: bool = false
var _loading_path: String = ""

func start_load(path: String) -> bool:
	if _is_loading:
		return false
	
	if not ResourceLoader.exists(path):
		_is_loading = true
		_loading_path = path
		call_deferred("_fail", "File does not exist")
		return true
		
	var err = ResourceLoader.load_threaded_request(path)
	if err != OK:
		_is_loading = true
		_loading_path = path
		call_deferred("_fail", "Failed to start loading")
		return true
		
	_is_loading = true
	_loading_path = path
	set_process(true)
	return true

func cancel() -> void:
	if _is_loading:
		_is_loading = false
		_loading_path = ""
		set_process(false)

func is_loading() -> bool:
	return _is_loading

func _fail(reason: String) -> void:
	if not _is_loading:
		return
	_is_loading = false
	_loading_path = ""
	set_process(false)
	load_failed.emit(reason)

func _ready() -> void:
	set_process(false)

func _process(_delta: float) -> void:
	if not _is_loading:
		set_process(false)
		return
		
	var progress_array = []
	var status = ResourceLoader.load_threaded_get_status(_loading_path, progress_array)
	
	if status == ResourceLoader.THREAD_LOAD_IN_PROGRESS:
		if progress_array.size() > 0:
			progress_updated.emit(progress_array[0])
	elif status == ResourceLoader.THREAD_LOAD_LOADED:
		var scene = ResourceLoader.load_threaded_get(_loading_path) as PackedScene
		_is_loading = false
		_loading_path = ""
		set_process(false)
		if scene:
			progress_updated.emit(1.0)
			load_completed.emit(scene)
		else:
			load_failed.emit("Resource is not a PackedScene")
	elif status == ResourceLoader.THREAD_LOAD_FAILED:
		_fail("Thread load failed")
	elif status == ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
		_fail("Invalid resource")
