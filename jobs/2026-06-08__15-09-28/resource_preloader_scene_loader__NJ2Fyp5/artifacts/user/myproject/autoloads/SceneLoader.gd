extends Node

## Emitted every frame while a load is in progress. fraction is in [0.0, 1.0].
signal progress_updated(fraction: float)

## Emitted once when loading succeeds, carrying the loaded PackedScene.
signal load_completed(scene: PackedScene)

## Emitted when loading fails, carrying a human-readable reason string.
signal load_failed(reason: String)

# ── private state ──────────────────────────────────────────────────────────────

var _loading: bool = false
var _cancelled: bool = false
var _path: String = ""

# ── public API ─────────────────────────────────────────────────────────────────

## Begin loading *path* in the background.
## Returns true if the load was accepted, false if one is already in progress.
func start_load(path: String) -> bool:
	if _loading:
		return false

	_loading   = true
	_cancelled = false
	_path      = path

	var err: int = ResourceLoader.load_threaded_request(path)
	if err != OK:
		_loading = false
		# Emit on the next frame so callers can connect first (same-frame safety).
		call_deferred("_emit_failed", "ResourceLoader.load_threaded_request failed with error %d for path: %s" % [err, path])
		return true          # We accepted the call; failure will arrive via signal.

	set_process(true)
	return true


## Cancel an in-progress load. Safe to call when not loading.
func cancel() -> void:
	if not _loading:
		return
	_cancelled = true
	_loading   = false
	set_process(false)
	# Drain the ResourceLoader queue to avoid leaking the request.
	# load_threaded_get() with a short timeout cleans up the pending request.
	ResourceLoader.load_threaded_get(_path)


## Returns true while a load is in progress.
func is_loading() -> bool:
	return _loading

# ── Node callbacks ─────────────────────────────────────────────────────────────

func _ready() -> void:
	set_process(false)   # Only process while a load is active.


func _process(_delta: float) -> void:
	if not _loading or _cancelled:
		set_process(false)
		return

	var progress: Array = []
	var status: int = ResourceLoader.load_threaded_get_status(_path, progress)

	match status:
		ResourceLoader.THREAD_LOAD_IN_PROGRESS:
			var fraction: float = progress[0] if progress.size() > 0 else 0.0
			fraction = clamp(fraction, 0.0, 1.0)
			emit_signal("progress_updated", fraction)

		ResourceLoader.THREAD_LOAD_LOADED:
			# Emit a final progress_updated(1.0) before completion.
			emit_signal("progress_updated", 1.0)
			_loading = false
			set_process(false)
			var resource = ResourceLoader.load_threaded_get(_path)
			if resource == null:
				emit_signal("load_failed", "load_threaded_get returned null for: " + _path)
			elif not resource is PackedScene:
				emit_signal("load_failed", "Loaded resource is not a PackedScene: " + _path)
			else:
				emit_signal("load_completed", resource)

		ResourceLoader.THREAD_LOAD_FAILED, ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
			_loading = false
			set_process(false)
			emit_signal("load_failed", "ResourceLoader reported status %d for: %s" % [status, _path])

# ── helpers ────────────────────────────────────────────────────────────────────

func _emit_failed(reason: String) -> void:
	_loading = false
	emit_signal("load_failed", reason)
