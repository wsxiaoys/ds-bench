extends SceneTree
## Headless verification that drives `Animator.tscn` through its
## deterministic tween sequence and checks every checkpoint from
## the specification table.

const ANIMATOR_SCENE := "res://scenes/Animator.tscn"
const DT := 0.01

var _animator: Node
var _controller: Node
var _target: Node2D
var _tween: Tween

var a_count: int = 0
var b_count: int = 0
var c_count: int = 0
var done_count: int = 0

var _errors: Array[String] = []
var _step: int = 0

func _initialize() -> void:
	print("=== tween_chain_sequence_animation verifier ===")
	var packed: PackedScene = load(ANIMATOR_SCENE)
	if packed == null:
		_fail("Failed to load scene %s" % ANIMATOR_SCENE)
		return
	_animator = packed.instantiate()
	get_root().add_child(_animator)
	_controller = _animator.get_node("TweenController")
	_target = _animator.get_node("Target")

	# Verify initial state.
	if not _approx_pos(_target.position, Vector2.ZERO):
		_errors.append("Initial position is not (0,0)")
	if not _approx(_target.rotation, 0.0):
		_errors.append("Initial rotation is not 0")
	if not _approx_pos(_target.scale, Vector2.ONE):
		_errors.append("Initial scale is not (1,1)")
	if not _approx(_target.modulate.a, 1.0):
		_errors.append("Initial modulate.a is not 1")

	_controller.step_a_complete.connect(func() -> void: a_count += 1)
	_controller.step_b_complete.connect(func() -> void: b_count += 1)
	_controller.step_c_complete.connect(func() -> void: c_count += 1)
	_controller.animation_complete.connect(func() -> void: done_count += 1)

	_tween = _controller.play_sequence()
	if _tween == null:
		_fail("play_sequence() returned null")
		return

	# Spec: verifier pauses the tween and drives it manually.
	_tween.pause()


func _physics_process(delta: float) -> bool:
	if _tween == null:
		return false
	_step += 1
	_tween.custom_step(DT)
	var t := float(_step) * DT

	# Helper closure to keep the checkpoint table concise.
	var check := func(label: String, want_a: int, want_b: int, want_c: int, want_d: int) -> void:
		if a_count != want_a:
			_errors.append("%s: step_a_complete expected %d, got %d" % [label, want_a, a_count])
		if b_count != want_b:
			_errors.append("%s: step_b_complete expected %d, got %d" % [label, want_b, b_count])
		if c_count != want_c:
			_errors.append("%s: step_c_complete expected %d, got %d" % [label, want_c, c_count])
		if done_count != want_d:
			_errors.append("%s: animation_complete expected %d, got %d" % [label, want_d, done_count])

	# Signal-count checkpoints
	if _step == 50:
		check.call("t=0.50", 0, 0, 0, 0)
		if not _approx_pos(_target.position, Vector2(100, 50), 5.0):
			_errors.append("t=0.50: position expected ~(100,50), got %s" % str(_target.position))
	elif _step == 100:
		check.call("t=1.00", 1, 0, 0, 0)
		if not _approx_pos(_target.position, Vector2(200, 100)):
			_errors.append("t=1.00: position expected (200,100), got %s" % str(_target.position))
	elif _step == 150:
		check.call("t=1.50", 1, 0, 0, 0)
		if not _approx_pos(_target.scale, Vector2(1.5, 1.5), 0.2):
			_errors.append("t=1.50: scale expected ~(1.5,1.5), got %s" % str(_target.scale))
		if not _approx(_target.modulate.a, 0.75, 0.05):
			_errors.append("t=1.50: modulate.a expected ~0.75, got %f" % _target.modulate.a)
	elif _step == 200:
		check.call("t=2.00", 1, 1, 0, 0)
		if not _approx_pos(_target.scale, Vector2(2, 2)):
			_errors.append("t=2.00: scale expected (2,2), got %s" % str(_target.scale))
		if not _approx(_target.modulate.a, 0.5, 0.05):
			_errors.append("t=2.00: modulate.a expected ~0.5, got %f" % _target.modulate.a)
	elif _step == 300:
		check.call("t=3.00", 1, 1, 1, 0)
		if not _approx(_target.rotation, PI / 2.0, 0.01):
			_errors.append("t=3.00: rotation expected PI/2, got %f" % _target.rotation)
	elif _step == 350:
		check.call("t=3.50", 1, 1, 1, 1)
		if not _approx(_target.modulate.r, 0.5, 0.05):
			_errors.append("t=3.50: modulate.r expected 0.5, got %f" % _target.modulate.r)
		if not _approx(_target.modulate.g, 1.0, 0.05):
			_errors.append("t=3.50: modulate.g expected 1.0, got %f" % _target.modulate.g)
		if not _approx(_target.modulate.b, 1.0, 0.05):
			_errors.append("t=3.50: modulate.b expected 1.0, got %f" % _target.modulate.b)
		if not _approx(_target.modulate.a, 1.0, 0.05):
			_errors.append("t=3.50: modulate.a expected 1.0, got %f" % _target.modulate.a)
		if _controller.is_running():
			_errors.append("t=3.50: is_running() expected false, got true")

	if _step >= 350:
		_finalize()
		return true
	return false


func _finalize() -> void:
	# Extra final checks
	if _errors.is_empty():
		print("ALL CHECKS PASSED")
		quit(0)
	else:
		for e in _errors:
			print("FAIL: ", e)
		quit(1)


func _fail(msg: String) -> void:
	print("FAIL: ", msg)
	quit(1)


func _approx(a: float, b: float, tol: float = 0.05) -> bool:
	return absf(a - b) <= tol


func _approx_pos(a: Vector2, b: Vector2, tol: float = 0.05) -> bool:
	return absf(a.x - b.x) <= tol and absf(a.y - b.y) <= tol
