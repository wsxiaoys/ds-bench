class_name FrameScheduler
extends RefCounted

## Deterministic, frame-based cooperative coroutine scheduler.
##
## All timing is driven exclusively by calls to `advance()`. No engine main
## loop, timers, or wall-clock sources are used anywhere in this file.

enum WaitKind {
	NONE,
	FRAMES,
	UNTIL,
	SIGNAL,
}

## Tiny helper object whose sole purpose is to provide a private, per-task
## "resume" signal that a suspended coroutine can `await`. Godot resumes an
## `await`-ed coroutine synchronously from within the `emit()` call, which is
## exactly the property this scheduler relies on for deterministic,
## same-frame, in-order resumption.
class _TaskResume extends RefCounted:
	signal fired


class _Task extends RefCounted:
	var id: int
	var task_name: String
	var on_complete: Callable
	var finished: bool = false

	var wait_kind: int = WaitKind.NONE

	# WaitKind.FRAMES
	var wait_target_frame: int = 0

	# WaitKind.UNTIL
	var wait_cond: Callable = Callable()

	# WaitKind.SIGNAL
	var signal_fired: bool = false
	var signal_cb: Callable = Callable()
	var waited_signal: Signal

	var resume: _TaskResume = _TaskResume.new()


var current_frame: int = 0

var _tasks: Array = []
var _current_task_id: int = -1


func spawn(task_name: String, body: Callable, on_complete: Callable = Callable()) -> void:
	var t := _Task.new()
	t.id = _tasks.size()
	t.task_name = task_name
	t.on_complete = on_complete
	_tasks.append(t)

	_current_task_id = t.id
	await _run_task(t, body)


func wait_frames(n: int) -> void:
	var t: _Task = _tasks[_current_task_id]
	t.wait_kind = WaitKind.FRAMES
	t.wait_target_frame = current_frame + n
	await t.resume.fired


func wait_until(cond: Callable) -> void:
	var t: _Task = _tasks[_current_task_id]
	t.wait_kind = WaitKind.UNTIL
	t.wait_cond = cond
	await t.resume.fired


func wait_signal(sig: Signal) -> void:
	var t: _Task = _tasks[_current_task_id]
	t.wait_kind = WaitKind.SIGNAL
	t.signal_fired = false
	t.waited_signal = sig

	var cb := func(_a = null, _b = null, _c = null, _d = null):
		t.signal_fired = true
	t.signal_cb = cb
	sig.connect(cb)

	await t.resume.fired

	if sig.is_connected(cb):
		sig.disconnect(cb)
	# Break the t <-> cb reference cycle (the closure captures `t`, and `t`
	# was holding a reference to the closure) so RefCounted objects are
	# freed promptly instead of leaking.
	t.signal_cb = Callable()


func advance(frames: int) -> void:
	for _i in range(frames):
		current_frame += 1

		for t: _Task in _tasks:
			if t.finished:
				continue
			if t.wait_kind == WaitKind.NONE:
				continue

			var ready := false
			match t.wait_kind:
				WaitKind.FRAMES:
					ready = current_frame == t.wait_target_frame
				WaitKind.UNTIL:
					ready = t.wait_cond.call()
				WaitKind.SIGNAL:
					ready = t.signal_fired

			if ready:
				t.wait_kind = WaitKind.NONE
				_current_task_id = t.id
				t.resume.fired.emit()


func _run_task(t: _Task, body: Callable) -> void:
	await body.call()
	t.finished = true
	t.wait_kind = WaitKind.NONE
	if t.on_complete.is_valid():
		t.on_complete.call(t.task_name)
