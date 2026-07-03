extends Node
class_name SceneLoader

signal progress_updated(fraction)
signal load_completed(scene)
signal load_failed(reason)

var _loading: bool = false
var _current_path: String = ""
var _current_thread: Thread = null
var _mutex: Mutex = Mutex.new()
var _cancel_requested: bool = false
var _last_resource: Resource = null
var _progress_value: float = 0.0
var _completed: bool = false
var _failed: bool = false
var _failure_reason: String = ""

func start_load(path: String) -> bool:
	_mutex.lock()
	if _loading:
		_mutex.unlock()
		return false
	_loading = true
	_cancel_requested = false
	_progress_value = 0.0
	_completed = false
	_failed = false
	_failure_reason = ""
	_last_resource = null
	_current_path = path
	_mutex.unlock()

	# Check existence quickly first
	if not ResourceLoader.exists(path):
		_mutex.lock()
		_loading = false
		_current_path = ""
		_failed = true
		_failure_reason = "Resource does not exist: " + path
		_mutex.unlock()
		call_deferred("emit_signal", "load_failed", _failure_reason)
		return true

	# Kick off async load using ResourceLoader.load_threaded_request
	var err := ResourceLoader.load_threaded_request(path)
	if err != OK:
		_mutex.lock()
		_loading = false
		_current_path = ""
		_failed = true
		_failure_reason = "load_threaded_request failed with error %d" % err
		_mutex.unlock()
		call_deferred("emit_signal", "load_failed", _failure_reason)
		return true

	# Start a background thread to poll progress
	_current_thread = Thread.new()
	_current_thread.start(_load_worker.bind(path))
	return true

func cancel() -> void:
	_mutex.lock()
	if not _loading:
		_mutex.unlock()
		return
	_cancel_requested = true
	_mutex.unlock()
	if _current_thread != null and _current_thread.is_started():
		_current_thread.wait_to_finish()
	_current_thread = null
	_mutex.lock()
	_loading = false
	_cancel_requested = false
	_current_path = ""
	_progress_value = 0.0
	_completed = false
	_failed = false
	_mutex.unlock()

func is_loading() -> bool:
	_mutex.lock()
	var v := _loading
	_mutex.unlock()
	return v


func _exit_tree() -> void:
	_cleanup_thread()

func _cleanup_thread() -> void:
	_mutex.lock()
	_cancel_requested = true
	_mutex.unlock()
	if _current_thread != null and _current_thread.is_started():
		_current_thread.wait_to_finish()
	_current_thread = null

func _load_worker(path: String) -> void:
	var last_emit := -1.0
	while true:
		_mutex.lock()
		if _cancel_requested:
			_mutex.unlock()
			return
		_mutex.unlock()

		var progress := []
		var status := ResourceLoader.load_threaded_get_status(path, progress)
		var frac: float = 0.0
		if progress.size() > 0:
			frac = float(progress[0])
		if frac < 0.0:
			frac = 0.0
		if frac > 1.0:
			frac = 1.0
		_mutex.lock()
		_progress_value = frac
		_mutex.unlock()
		if abs(frac - last_emit) > 0.0001 or status == ResourceLoader.THREAD_LOAD_LOADED:
			last_emit = frac
			call_deferred("emit_signal", "progress_updated", frac)

		match status:
			ResourceLoader.THREAD_LOAD_IN_PROGRESS:
				OS.delay_msec(16)
			ResourceLoader.THREAD_LOAD_LOADED:
				var res := ResourceLoader.load_threaded_get(path)
				_mutex.lock()
				if _cancel_requested:
					_mutex.unlock()
					return
				_last_resource = res
				_loading = false
				_current_path = ""
				_completed = true
				_mutex.unlock()
				call_deferred("emit_signal", "load_completed", res)
				return
			ResourceLoader.THREAD_LOAD_FAILED:
				_mutex.lock()
				_loading = false
				_current_path = ""
				_failed = true
				_failure_reason = "Threaded load failed for: " + path
				_mutex.unlock()
				call_deferred("emit_signal", "load_failed", _failure_reason)
				return
			_:
				OS.delay_msec(16)
