extends Node
class_name SceneLoader

## Asynchronous scene loader singleton.
##
## Exposes start_load / cancel / is_loading and the progress_updated /
## load_completed / load_failed signals. Uses Godot's threaded resource
## loader so the main thread keeps running while a scene loads.

signal progress_updated(fraction)
signal load_completed(scene)
signal load_failed(reason)

const _STATUS_IN_PROGRESS := 0
const _STATUS_LOADED := 1
const _STATUS_FAILED := 2
const _STATUS_INVALID_RESOURCE := 3
const _POLL_INTERVAL_SEC := 0.05

var _loading_path: String = ""
var _loading: bool = false
var _cancelled: bool = false

func start_load(path: String) -> bool:
	if _loading:
		return false
	if path.is_empty():
		push_error("SceneLoader.start_load called with empty path")
		return false
	# Validate that the resource exists before issuing a threaded request,
	# otherwise we still need to surface a failure within the time budget.
	if not ResourceLoader.exists(path):
		_loading = true
		_loading_path = path
		_cancelled = false
		_emit_failure_async("resource_not_found", path)
		return true

	# Reset state and kick off the threaded load.
	_loading = true
	_loading_path = path
	_cancelled = false

	var err := ResourceLoader.load_threaded_request(path)
	if err != OK:
		_loading = false
		_loading_path = ""
		_emit_failure_async("request_failed", path)
		return true

	# Kick off the polling loop on the next idle frame so the caller can
	# observe progress and signals on subsequent frames.
	call_deferred("_poll")
	return true

func cancel() -> void:
	if not _loading:
		return
	_cancelled = true
	_loading = false
	_loading_path = ""
	# Best-effort: drain any pending threaded status so the worker can be
	# reused, but don't surface completion to listeners.

func is_loading() -> bool:
	return _loading

func _poll() -> void:
	# Re-entry guard, also covers the cancel case.
	if not _loading or _cancelled:
		return

	var current_path := _loading_path
	var progress: Array = []
	var status := ResourceLoader.load_threaded_get_status(current_path, progress)

	var raw_fraction: float = 0.0
	if progress.size() > 0:
		raw_fraction = float(progress[0])
	var fraction: float = clamp(raw_fraction, 0.0, 1.0)
	progress_updated.emit(fraction)

	match status:
		_STATUS_IN_PROGRESS:
			await get_tree().create_timer(_POLL_INTERVAL_SEC).timeout
			_poll()
		_STATUS_LOADED:
			var resource: Resource = ResourceLoader.load_threaded_get(current_path)
			_loading = false
			_loading_path = ""
			if _cancelled:
				return
			if resource == null:
				load_failed.emit("load_returned_null")
			elif not (resource is PackedScene):
				load_failed.emit("not_a_packed_scene")
			else:
				load_completed.emit(resource)
		_STATUS_FAILED, _STATUS_INVALID_RESOURCE:
			_loading = false
			_loading_path = ""
			if _cancelled:
				return
			load_failed.emit("threaded_load_failed")
		_:
			# Unknown state, treat as failure but keep listeners informed.
			_loading = false
			_loading_path = ""
			if _cancelled:
				return
			load_failed.emit("unknown_status")

func _emit_failure_async(reason: String, path: String) -> void:
	# Defer the failure emission so callers of start_load receive a
	# consistent return value before any signal fires.
	call_deferred("_emit_failure", reason, path)

func _emit_failure(reason: String, path: String) -> void:
	if _cancelled:
		_loading = false
		_loading_path = ""
		return
	if not _loading:
		return
	_loading = false
	_loading_path = ""
	load_failed.emit(reason)
