## Headless smoke-test for TweenController.
## Run with:
##   godot --headless --script tests/test_tween.gd
extends SceneTree

const SCENE_PATH := "res://scenes/Animator.tscn"
const STEP       := 0.01   # seconds per custom_step()
const EPS        := 0.005  # tolerance for float comparisons

var _animator : Node2D
var _ctrl     : Node
var _target   : Node2D
var _tween    : Tween

# Signal counters
var _cnt_a    := 0
var _cnt_b    := 0
var _cnt_c    := 0
var _cnt_done := 0

func _init() -> void:
	# Load and instantiate the scene
	var packed : PackedScene = load(SCENE_PATH)
	_animator = packed.instantiate() as Node2D
	root.add_child(_animator)

	_target = _animator.get_node("Target") as Node2D
	_ctrl   = _animator.get_node("TweenController")

	# Connect signals
	_ctrl.step_a_complete.connect(func(): _cnt_a += 1)
	_ctrl.step_b_complete.connect(func(): _cnt_b += 1)
	_ctrl.step_c_complete.connect(func(): _cnt_c += 1)
	_ctrl.animation_complete.connect(func(): _cnt_done += 1)

	_tween = _ctrl.play_sequence()
	assert(_tween != null, "play_sequence() must return a Tween")
	assert(_tween is Tween, "play_sequence() must return a Tween instance")
	assert(_ctrl.is_running(), "is_running() must be true immediately after play_sequence()")

	# Drive tween manually
	_run_test()

func _advance(seconds: float) -> void:
	var steps := int(round(seconds / STEP))
	for i in steps:
		_tween.custom_step(STEP)

func _run_test() -> void:
	# ---- t = 0.50 s ----
	_advance(0.50)
	_check_near(_target.position.x, 100.0, "t=0.50 pos.x")
	_check_near(_target.position.y, 50.0,  "t=0.50 pos.y")
	_check_signals(0, 0, 0, 0, "t=0.50")

	# ---- t = 1.00 s ----
	_advance(0.50)
	_check_near(_target.position.x, 200.0, "t=1.00 pos.x")
	_check_near(_target.position.y, 100.0, "t=1.00 pos.y")
	_check_signals(1, 0, 0, 0, "t=1.00")

	# ---- t = 1.50 s ----
	_advance(0.50)
	_check_near(_target.scale.x,    1.5,  "t=1.50 scale.x")
	_check_near(_target.scale.y,    1.5,  "t=1.50 scale.y")
	_check_near(_target.modulate.a, 0.75, "t=1.50 modulate.a")
	_check_signals(1, 0, 0, 0, "t=1.50")

	# ---- t = 2.00 s ----
	_advance(0.50)
	_check_near(_target.scale.x,    2.0, "t=2.00 scale.x")
	_check_near(_target.scale.y,    2.0, "t=2.00 scale.y")
	_check_near(_target.modulate.a, 0.5, "t=2.00 modulate.a")
	_check_signals(1, 1, 0, 0, "t=2.00")

	# ---- t = 3.00 s ----
	_advance(1.00)
	_check_near(_target.rotation, PI / 2.0, "t=3.00 rotation")
	_check_signals(1, 1, 1, 0, "t=3.00")

	# ---- t = 3.50 s ----
	_advance(0.50)
	_check_near(_target.modulate.r, 0.5, "t=3.50 modulate.r")
	_check_near(_target.modulate.g, 1.0, "t=3.50 modulate.g")
	_check_near(_target.modulate.b, 1.0, "t=3.50 modulate.b")
	_check_near(_target.modulate.a, 1.0, "t=3.50 modulate.a")
	_check_signals(1, 1, 1, 1, "t=3.50")
	assert(!_ctrl.is_running(), "is_running() must be false after animation_complete")

	print("ALL TESTS PASSED")
	quit(0)

func _check_near(actual: float, expected: float, label: String) -> void:
	if abs(actual - expected) > EPS:
		print("FAIL  %s: expected %.4f  got %.4f" % [label, expected, actual])
		quit(1)

func _check_signals(a: int, b: int, c: int, done: int, label: String) -> void:
	var ok := _cnt_a == a and _cnt_b == b and _cnt_c == c and _cnt_done == done
	if not ok:
		print("FAIL  signals @ %s: a=%d b=%d c=%d done=%d  (expected %d %d %d %d)"
			% [label, _cnt_a, _cnt_b, _cnt_c, _cnt_done, a, b, c, done])
		quit(1)
