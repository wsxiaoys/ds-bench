class_name FrameScheduler
extends RefCounted

# Public properties
var current_frame: int = 0

# Inner class to provide a custom resume signal for each task
class TaskSignal extends RefCounted:
	signal resume

# Private properties
var _tasks: Array = []
var _current_task_id: int = -1

func spawn(task_name: String, body: Callable, on_complete: Callable = Callable()) -> void:
	var task_id = _tasks.size()
	var task_signal = TaskSignal.new()
	var task_data = {
		"id": task_id,
		"name": task_name,
		"body": body,
		"on_complete": on_complete,
		"state": "RUNNING",
		"wait_type": "NONE",
		"target_frame": -1,
		"condition": Callable(),
		"signal_to_wait": null,
		"signal_emitted": false,
		"signal_callback": Callable(),
		"resume_signal": task_signal
	}
	_tasks.append(task_data)
	
	_run_task(task_id, body, task_name, on_complete)
	_current_task_id = -1

func _run_task(task_id: int, body: Callable, task_name: String, on_complete: Callable) -> void:
	_current_task_id = task_id
	await body.call()
	
	_tasks[task_id].state = "COMPLETED"
	_tasks[task_id].wait_type = "NONE"
	
	if on_complete.is_valid():
		on_complete.call(task_name)

func wait_frames(n: int) -> void:
	var task_id = _current_task_id
	assert(task_id >= 0 and task_id < _tasks.size(), "wait_frames called outside of a task context")
	assert(n >= 1, "n must be >= 1")
	
	var task_data = _tasks[task_id]
	task_data.state = "SUSPENDED"
	task_data.wait_type = "FRAMES"
	task_data.target_frame = current_frame + n
	
	await task_data.resume_signal.resume

func wait_until(cond: Callable) -> void:
	var task_id = _current_task_id
	assert(task_id >= 0 and task_id < _tasks.size(), "wait_until called outside of a task context")
	
	var task_data = _tasks[task_id]
	task_data.state = "SUSPENDED"
	task_data.wait_type = "UNTIL"
	task_data.condition = cond
	
	await task_data.resume_signal.resume

func wait_signal(sig: Signal) -> void:
	var task_id = _current_task_id
	assert(task_id >= 0 and task_id < _tasks.size(), "wait_signal called outside of a task context")
	
	var task_data = _tasks[task_id]
	task_data.state = "SUSPENDED"
	task_data.wait_type = "SIGNAL"
	task_data.signal_to_wait = sig
	task_data.signal_emitted = false
	
	var arity = _get_signal_arity(sig)
	var callback: Callable
	match arity:
		0: callback = _cb0.bind(task_id)
		1: callback = _cb1.bind(task_id)
		2: callback = _cb2.bind(task_id)
		3: callback = _cb3.bind(task_id)
		4: callback = _cb4.bind(task_id)
		5: callback = _cb5.bind(task_id)
		6: callback = _cb6.bind(task_id)
		7: callback = _cb7.bind(task_id)
		8: callback = _cb8.bind(task_id)
		9: callback = _cb9.bind(task_id)
		10: callback = _cb10.bind(task_id)
		_: callback = _cb10.bind(task_id)
	
	task_data.signal_callback = callback
	sig.connect(callback)
	
	await task_data.resume_signal.resume
	
	if is_instance_valid(sig.get_object()) and sig.is_connected(callback):
		sig.disconnect(callback)

func advance(frames: int) -> void:
	for f in range(frames):
		current_frame += 1
		
		var num_tasks = _tasks.size()
		for task_id in range(num_tasks):
			var task_data = _tasks[task_id]
			if task_data.state == "SUSPENDED":
				var should_resume = false
				match task_data.wait_type:
					"FRAMES":
						if task_data.target_frame == current_frame:
							should_resume = true
					"UNTIL":
						if task_data.condition.call() == true:
							should_resume = true
					"SIGNAL":
						if task_data.signal_emitted == true:
							should_resume = true
				
				if should_resume:
					task_data.state = "RUNNING"
					task_data.wait_type = "NONE"
					_current_task_id = task_id
					task_data.resume_signal.resume.emit()
					_current_task_id = -1

func _get_signal_arity(sig: Signal) -> int:
	var obj = sig.get_object()
	if not is_instance_valid(obj):
		return 0
	var sig_name = sig.get_name()
	var sig_list = obj.get_signal_list()
	for s in sig_list:
		if s["name"] == sig_name:
			return s["args"].size()
	return 0

func _on_task_signal(task_id: int) -> void:
	var task_data = _tasks[task_id]
	task_data.signal_emitted = true

func _cb0(task_id: int): _on_task_signal(task_id)
func _cb1(_a, task_id: int): _on_task_signal(task_id)
func _cb2(_a, _b, task_id: int): _on_task_signal(task_id)
func _cb3(_a, _b, _c, task_id: int): _on_task_signal(task_id)
func _cb4(_a, _b, _c, _d, task_id: int): _on_task_signal(task_id)
func _cb5(_a, _b, _c, _d, _e, task_id: int): _on_task_signal(task_id)
func _cb6(_a, _b, _c, _d, _e, _f, task_id: int): _on_task_signal(task_id)
func _cb7(_a, _b, _c, _d, _e, _f, _g, task_id: int): _on_task_signal(task_id)
func _cb8(_a, _b, _c, _d, _e, _f, _g, _h, task_id: int): _on_task_signal(task_id)
func _cb9(_a, _b, _c, _d, _e, _f, _g, _h, _i, task_id: int): _on_task_signal(task_id)
func _cb10(_a, _b, _c, _d, _e, _f, _g, _h, _i, _j, task_id: int): _on_task_signal(task_id)
