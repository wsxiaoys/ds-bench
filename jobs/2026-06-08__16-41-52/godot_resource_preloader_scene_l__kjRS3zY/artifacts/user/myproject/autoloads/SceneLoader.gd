extends Node

## Emitted periodically during loading with a fraction in [0.0, 1.0].
signal progress_updated(fraction: float)
## Emitted exactly once when loading succeeds, carrying the loaded PackedScene.
signal load_completed(scene: PackedScene)
## Emitted exactly once when loading fails, carrying a human-readable reason.
signal load_failed(reason: String)

var _loading: bool = false
var _requested_path: String = ""
var _cancelled: bool = false


func start_load(path: String) -> bool:
	if _loading:
		return false
	_loading = true
	_cancelled = false
	_requested_path = path

	var err := ResourceLoader.load_threaded_request(path, "", false)
	if err != OK:
		_loading = false
		_requested_path = ""
		load_failed.emit("Failed to request load for: " + path + " (error " + str(err) + ")")
		return false

	return true


func cancel() -> void:
	if not _loading:
		return
	_cancelled = true
	_loading = false
	_requested_path = ""


func is_loading() -> bool:
	return _loading


func _process(_delta: float) -> void:
	if not _loading:
		return

	var status := ResourceLoader.load_threaded_get_status(_requested_path)
	match status:
		ResourceLoader.THREAD_LOAD_IN_PROGRESS:
			var fraction: float = 0.0
			var progress_array: Array = []
			var poll_status := ResourceLoader.load_threaded_get_status(_requested_path, progress_array)
			if poll_status == ResourceLoader.THREAD_LOAD_IN_PROGRESS and progress_array.size() > 0:
				fraction = float(progress_array[0])
				if fraction < 0.0:
					fraction = 0.0
				elif fraction > 1.0:
					fraction = 1.0
			else:
				# Fallback: estimate based on status alone
				fraction = 0.5
			progress_updated.emit(fraction)

		ResourceLoader.THREAD_LOAD_LOADED:
			if _cancelled:
				_loading = false
				_cancelled = false
				_requested_path = ""
				return

			var resource: Resource = ResourceLoader.load_threaded_get(_requested_path)
			if resource == null:
				_loading = false
				_requested_path = ""
				load_failed.emit("Loaded resource is null for: " + _requested_path)
				return

			if not (resource is PackedScene):
				_loading = false
				_requested_path = ""
				load_failed.emit("Loaded resource is not a PackedScene for: " + _requested_path)
				return

			progress_updated.emit(1.0)
			_loading = false
			_requested_path = ""
			load_completed.emit(resource as PackedScene)

		ResourceLoader.THREAD_LOAD_FAILED:
			_loading = false
			_requested_path = ""
			load_failed.emit("Failed to load resource: " + _requested_path)

		ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
			_loading = false
			_requested_path = ""
			load_failed.emit("Invalid resource path: " + _requested_path)
