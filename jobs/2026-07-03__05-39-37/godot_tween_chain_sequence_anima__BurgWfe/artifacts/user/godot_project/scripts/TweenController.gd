extends Node
## TweenController — drives a multi-step Tween animation on the sibling Target node.
##
## The animation is split into four logical steps:
##   1. Sequential  — position  (0 → 2.0 s)  TRANS_LINEAR
##   2. Parallel    — scale + modulate.a  (2.0 → 3.0 s)  TRANS_LINEAR  [relative to sequence start]
##   3. Sequential  — rotation  (3.0 → 4.0 s)  TRANS_QUAD / EASE_OUT
##   4. Parallel    — modulate.r + modulate.a  (4.0 → 4.5 s)  TRANS_CUBIC / EASE_IN
##
## Signal checkpoints are placed via tween_callback so that each signal fires
## exactly once at the correct point in the timeline.

# ------------------------------------------------------------------ signals

signal step_a_complete()
signal step_b_complete()
signal step_c_complete()
signal animation_complete()

# ------------------------------------------------------------------ state

var _running: bool = false

# Target is the sibling Node2D named "Target".
var _target: Node2D = null

# ------------------------------------------------------------------ lifecycle

func _ready() -> void:
	_target = get_parent().get_node("Target")

# ------------------------------------------------------------------ public API

## Builds and returns the active Tween that drives the full animation on Target.
## The caller may pause() the returned tween and advance it with custom_step().
func play_sequence() -> Tween:
	_running = true
	if _target == null:
		_target = get_parent().get_node("Target")

	# Use get_tree().create_tween() (NOT Node.create_tween()) so the
	# returned tween is not bound to this node via process mode — that
	# binding prevents custom_step() from advancing the tween when the
	# verifier pauses it and drives it manually.
	var tween: Tween = get_tree().create_tween()

	# ---- Step 1 (sequential) — position (0,0) → (200,100), 1.0 s, TRANS_LINEAR
	tween.tween_property(_target, "position", Vector2(200.0, 100.0), 1.0) \
		.set_trans(Tween.TRANS_LINEAR)
	tween.tween_callback(_emit_step_a)

	# ---- Step 2 (parallel block) — scale (1,1)→(2,2) AND modulate.a 1→0.5,
	#      1.0 s, TRANS_LINEAR
	tween.set_parallel(true)
	tween.tween_property(_target, "scale", Vector2(2.0, 2.0), 1.0) \
		.set_trans(Tween.TRANS_LINEAR)
	tween.tween_property(_target, "modulate:a", 0.5, 1.0) \
		.set_trans(Tween.TRANS_LINEAR)
	tween.set_parallel(false)
	tween.tween_callback(_emit_step_b)

	# ---- Step 3 (sequential) — rotation 0 → PI/2, 1.0 s, TRANS_QUAD / EASE_OUT
	tween.tween_property(_target, "rotation", PI * 0.5, 1.0) \
		.set_trans(Tween.TRANS_QUAD) \
		.set_ease(Tween.EASE_OUT)
	tween.tween_callback(_emit_step_c)

	# ---- Step 4 (parallel block) — modulate.r 1→0.5 AND modulate.a 0.5→1.0,
	#      0.5 s, TRANS_CUBIC / EASE_IN
	tween.set_parallel(true)
	tween.tween_property(_target, "modulate:r", 0.5, 0.5) \
		.set_trans(Tween.TRANS_CUBIC) \
		.set_ease(Tween.EASE_IN)
	tween.tween_property(_target, "modulate:a", 1.0, 0.5) \
		.set_trans(Tween.TRANS_CUBIC) \
		.set_ease(Tween.EASE_IN)
	tween.set_parallel(false)
	tween.tween_callback(_emit_animation_complete)

	return tween

## Returns true while the animation sequence is running, false after
## animation_complete has fired (or before play_sequence is called).
func is_running() -> bool:
	return _running

# ------------------------------------------------------------------ callbacks

func _emit_step_a() -> void:
	step_a_complete.emit()

func _emit_step_b() -> void:
	step_b_complete.emit()

func _emit_step_c() -> void:
	step_c_complete.emit()

func _emit_animation_complete() -> void:
	animation_complete.emit()
	_running = false