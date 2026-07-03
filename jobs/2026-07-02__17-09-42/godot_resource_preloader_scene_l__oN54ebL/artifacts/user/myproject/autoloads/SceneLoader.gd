extends Node
class_name SceneLoader

## Asynchronous scene loader singleton.
##
## Use [method start_load] to begin loading a [PackedScene] from disk. The
## loader emits [signal progress_updated] while loading, and finishes by
## emitting either [signal load_completed] (with the loaded [PackedScene])
## or [signal load_failed] (with a human readable reason).
## Call [method cancel] at any time to abandon the in-flight load; a fresh
## [method start_load] may then be issued immediately.
##
## The loader uses [method ResourceLoader.load_threaded_request] under the
## hood, so loading work happens on a worker thread. Poll progress with
## [method ResourceLoader.load_threaded_get_status] on each main-loop tick.

signal progress_updated(fraction)
signal load_completed(scene)
signal load_failed(reason)

const POLL_INTERVAL := 0.05
const INVALID_FRACTION := -1.0

var _loading: bool = false
var _current_path: String = ""
var _pending_failed_reason: String = ""
var _had_pending_failure: bool = false
var _progress: Array = [0.0]
var _accumulator: float = 0.0

func is_loading() -> bool:
	return _loading

## Begin loading the [PackedScene] at [param path].
##
## Returns [code]true[/code] when a load has been accepted (either it has
## started or it failed and [signal load_failed] has been scheduled). Returns
## [code]false[/code] when another load is already in progress.
func start_load(path: String) -> bool:
	if _loading:
		return false

	_current_path = path
	_progress[0] = 0.0
	_pending_failed_reason = ""
	_had_pending_failure = false
	_accumulator = 0.0
	_loading = true
	# Make sure _process() is enabled each call in case a cancel disabled it.
	set_process(true)

	if not ResourceLoader.exists(path, "PackedScene"):
		# We still keep _loading true and emit load_failed on the next idle
		# frame so callers can connect to the signal before it fires.
		_pending_failed_reason = "Resource does not exist: %s" % path
		_had_pending_failure = true
		_schedule_failure()
		return true

	var err: int = ResourceLoader.load_threaded_request(path, "PackedScene", true)
	if err != OK:
		_pending_failed_reason = "Failed to start threaded load (err=%d): %s" % [err, path]
		_had_pending_failure = true
		_schedule_failure()
		return true

	return true

## Cancel any in-flight load. After calling this [method is_loading]
## immediately reports [code]false[/code] and [method start_load] may be
## called again.
func cancel() -> void:
	_loading = false
	_current_path = ""
	_pending_failed_reason = ""
	_had_pending_failure = false
	_accumulator = 0.0
	set_process(false)

func _schedule_failure() -> void:
	# Use call_deferred so that callers who connect to load_failed *after*
	# invoking start_load() still observe the emission.
	_loading = true
	set_process(true)

func _process(delta: float) -> void:
	if not _loading:
		return

	# Coalesce progress updates so we don't spam listeners every frame.
	_accumulator += delta
	if _accumulator < POLL_INTERVAL:
		return
	_accumulator = 0.0

	# If we already know the load failed (e.g. file doesn't exist), report
	# load_failed exactly once.
	if _had_pending_failure:
		_had_pending_failure = false
		_loading = false
		set_process(false)
		load_failed.emit(_pending_failed_reason)
		_pending_failed_reason = ""
		_current_path = ""
		return

	if _current_path.is_empty():
		_loading = false
		set_process(false)
		return

	var status: int = ResourceLoader.load_threaded_get_status(_current_path, _progress)
	var fraction: float = _progress[0]
	if fraction >= 0.0 and fraction <= 1.0:
		progress_updated.emit(fraction)

	match status:
		ResourceLoader.THREAD_LOAD_IN_PROGRESS:
			return
		ResourceLoader.THREAD_LOAD_LOADED:
			_loading = false
			set_process(false)
			var packed: PackedScene = ResourceLoader.load_threaded_get(_current_path)
			_current_path = ""
			if packed == null:
				load_failed.emit("Threaded loader returned null for completed load")
			else:
				load_completed.emit(packed)
			return
		ResourceLoader.THREAD_LOAD_FAILED:
			_loading = false
			set_process(false)
			var path_copy: String = _current_path
			_current_path = ""
			load_failed.emit("Threaded load failed for: %s" % path_copy)
			return
		ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
			_loading = false
			set_process(false)
			var path_copy2: String = _current_path
			_current_path = ""
			load_failed.emit("Invalid resource path: %s" % path_copy2)
			return
