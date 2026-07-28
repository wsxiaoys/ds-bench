extends SceneTree

const FrameScheduler = preload("res://scheduler/frame_scheduler.gd")

class Bus extends RefCounted:
	signal pulse

var sched := FrameScheduler.new()
var events: Array = []
var gate := {"open": false}
var bus := Bus.new()


func _done(task_name: String) -> void:
	events.append("%d|%s|complete" % [sched.current_frame, task_name])


func task_a() -> void:
	events.append("%d|A|start" % sched.current_frame)
	await sched.wait_frames(2)
	events.append("%d|A|resume" % sched.current_frame)
	await sched.wait_frames(2)
	events.append("%d|A|end" % sched.current_frame)


func task_b() -> void:
	events.append("%d|B|start" % sched.current_frame)
	await sched.wait_frames(1)
	events.append("%d|B|open_gate" % sched.current_frame)
	gate.open = true
	await sched.wait_frames(2)
	events.append("%d|B|pulse" % sched.current_frame)
	bus.pulse.emit()


func task_c() -> void:
	events.append("%d|C|start" % sched.current_frame)
	await sched.wait_until(func(): return gate.open)
	events.append("%d|C|gate_opened" % sched.current_frame)


func task_d() -> void:
	events.append("%d|D|start" % sched.current_frame)
	await sched.wait_signal(bus.pulse)
	events.append("%d|D|pulsed" % sched.current_frame)
	await sched.wait_frames(1)
	events.append("%d|D|end" % sched.current_frame)


func _initialize() -> void:
	sched.spawn("A", task_a, _done)
	sched.spawn("B", task_b, _done)
	sched.spawn("C", task_c, _done)
	sched.spawn("D", task_d, _done)
	sched.advance(7)

	var expected := [
		"0|A|start",
		"0|B|start",
		"0|C|start",
		"0|D|start",
		"1|B|open_gate",
		"1|C|gate_opened",
		"1|C|complete",
		"2|A|resume",
		"3|B|pulse",
		"3|B|complete",
		"3|D|pulsed",
		"4|A|end",
		"4|A|complete",
		"4|D|end",
		"4|D|complete",
	]

	print("EVENTS:")
	for e in events:
		print(e)

	if events == expected:
		print("RESULT: PASS")
	else:
		print("RESULT: FAIL")
		print("Expected %d events, got %d" % [expected.size(), events.size()])

	quit()
