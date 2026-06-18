extends Node
# class_name SceneLoader

signal progress_updated(fraction: float)
signal load_completed(scene: PackedScene)
signal load_failed(reason: String)

var _is_loading: bool = false
var _current_path: String = ""
var _last_progress: float = -1.0
var _fail_immediately: bool = false
var _fail_reason: String = ""

func start_load(path: String) -> bool:
	if _is_loading:
		return false
	
	_is_loading = true
	_current_path = path
	_last_progress = -1.0
	_fail_immediately = false
	_fail_reason = ""
	
	if not FileAccess.file_exists(path):
		_fail_immediately = true
		_fail_reason = "File does not exist: " + path
		return true
	
	var err = ResourceLoader.load_threaded_request(path)
	if err != OK:
		_fail_immediately = true
		_fail_reason = "Failed to request threaded load, error code: " + str(err)
		return true
	
	# Emit an initial progress of 0.0 to satisfy "at least one progress_updated signal fires"
	_last_progress = 0.0
	progress_updated.emit(0.0)
	
	return true

func cancel() -> void:
	_is_loading = false
	_current_path = ""
	_last_progress = -1.0
	_fail_immediately = false
	_fail_reason = ""

func is_loading() -> bool:
	return _is_loading

func _process(_delta: float) -> void:
	if not _is_loading:
		return
	
	if _fail_immediately:
		var reason = _fail_reason
		cancel() # resets _is_loading to false
		load_failed.emit(reason)
		return
	
	var progress = []
	var status = ResourceLoader.load_threaded_get_status(_current_path, progress)
	
	match status:
		ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
			var reason = "Invalid resource path: " + _current_path
			cancel()
			load_failed.emit(reason)
		ResourceLoader.THREAD_LOAD_IN_PROGRESS:
			if progress.size() > 0:
				var fraction = progress[0]
				fraction = clampf(fraction, 0.0, 1.0)
				if fraction > _last_progress:
					_last_progress = fraction
					progress_updated.emit(fraction)
		ResourceLoader.THREAD_LOAD_FAILED:
			var reason = "Failed to load resource: " + _current_path
			cancel()
			load_failed.emit(reason)
		ResourceLoader.THREAD_LOAD_LOADED:
			if _last_progress < 1.0:
				progress_updated.emit(1.0)
			
			var resource = ResourceLoader.load_threaded_get(_current_path)
			cancel()
			if resource is PackedScene:
				load_completed.emit(resource)
			else:
				load_failed.emit("Loaded resource is not a PackedScene")
