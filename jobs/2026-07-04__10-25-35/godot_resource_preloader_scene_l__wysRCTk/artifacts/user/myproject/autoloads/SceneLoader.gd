extends Node

# class_name SceneLoader

signal progress_updated(fraction: float)
signal load_completed(scene: PackedScene)
signal load_failed(reason: String)

var _loading_path: String = ""
var _is_loading: bool = false

func start_load(path: String) -> bool:
	if _is_loading:
		return false

	_is_loading = true
	_loading_path = path

	# Emit initial progress to guarantee at least one progress_updated signal fires
	progress_updated.emit(0.0)

	var err = ResourceLoader.load_threaded_request(path)
	if err != OK:
		# We don't fail synchronously, we let the process loop handle it asynchronously
		pass

	return true

func cancel() -> void:
	_is_loading = false
	_loading_path = ""

func is_loading() -> bool:
	return _is_loading

func _process(_delta: float) -> void:
	if not _is_loading:
		return

	if not FileAccess.file_exists(_loading_path):
		_fail_load("File does not exist: " + _loading_path)
		return

	var progress = []
	var status = ResourceLoader.load_threaded_get_status(_loading_path, progress)

	match status:
		ResourceLoader.THREAD_LOAD_IN_PROGRESS:
			var fraction = 0.0
			if progress.size() > 0:
				fraction = progress[0]
			fraction = clamp(fraction, 0.0, 1.0)
			progress_updated.emit(fraction)

		ResourceLoader.THREAD_LOAD_LOADED:
			# Emit 1.0 progress to complete the progress updates
			progress_updated.emit(1.0)
			
			var loaded_resource = ResourceLoader.load_threaded_get(_loading_path)
			if loaded_resource is PackedScene:
				var scene = loaded_resource as PackedScene
				_is_loading = false
				_loading_path = ""
				load_completed.emit(scene)
			else:
				_fail_load("Loaded resource is not a PackedScene")

		ResourceLoader.THREAD_LOAD_FAILED:
			_fail_load("Failed to load resource (ThreadLoadStatus failed)")

		ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
			_fail_load("Invalid resource path or type")

func _fail_load(reason: String) -> void:
	_is_loading = false
	_loading_path = ""
	load_failed.emit(reason)
