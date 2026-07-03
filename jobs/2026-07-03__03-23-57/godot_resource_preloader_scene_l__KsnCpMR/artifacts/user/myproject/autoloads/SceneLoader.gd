extends Node
# class_name SceneLoader

signal progress_updated(fraction: float)
signal load_completed(scene: PackedScene)
signal load_failed(reason: String)

var _is_loading: bool = false
var _current_path: String = ""
var _last_progress: float = -1.0

func start_load(path: String) -> bool:
	if _is_loading:
		return false
	
	_is_loading = true
	_current_path = path
	_last_progress = -1.0
	
	# Emit initial progress updated signal (satisfying "at least one progress_updated signal must fire")
	progress_updated.emit(0.0)
	_last_progress = 0.0
	
	if not FileAccess.file_exists(path):
		_fail_deferred.call_deferred("File does not exist: " + path)
		return true
	
	var err = ResourceLoader.load_threaded_request(path)
	if err != OK:
		_fail_deferred.call_deferred("Failed to start load: " + error_string(err))
		return true
	
	return true

func cancel() -> void:
	_is_loading = false
	_current_path = ""

func is_loading() -> bool:
	return _is_loading

func _fail_deferred(reason: String) -> void:
	if not _is_loading:
		return
	_is_loading = false
	_current_path = ""
	load_failed.emit(reason)

func _process(_delta: float) -> void:
	if not _is_loading:
		return
	
	if _current_path == "":
		return
	
	var progress: Array = []
	var status = ResourceLoader.load_threaded_get_status(_current_path, progress)
	
	match status:
		ResourceLoader.THREAD_LOAD_IN_PROGRESS:
			var fraction = 0.0
			if progress.size() > 0:
				fraction = progress[0]
			# Ensure we only emit if the fraction is valid and has changed
			if fraction >= 0.0 and fraction <= 1.0 and fraction != _last_progress:
				_last_progress = fraction
				progress_updated.emit(fraction)
		
		ResourceLoader.THREAD_LOAD_LOADED:
			if _last_progress < 1.0:
				progress_updated.emit(1.0)
			
			var resource = ResourceLoader.load_threaded_get(_current_path)
			_is_loading = false
			_current_path = ""
			if resource is PackedScene:
				load_completed.emit(resource)
			else:
				load_failed.emit("Loaded resource is not a PackedScene")
		
		ResourceLoader.THREAD_LOAD_FAILED, ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
			_is_loading = false
			var failed_path = _current_path
			_current_path = ""
			load_failed.emit("Failed to load resource: " + failed_path)
