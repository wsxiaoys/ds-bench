extends Node

## Signals — each emitted exactly once over the full run.
signal step_a_complete()
signal step_b_complete()
signal step_c_complete()
signal animation_complete()

var _active_tween: Tween = null
var _running: bool = false

## Builds and returns the active Tween driving the animation on Target.
## The verifier will pause() the returned tween and drive it with custom_step(0.01).
func play_sequence() -> Tween:
	# Kill any previous tween so we always start fresh.
	if _active_tween and _active_tween.is_valid():
		_active_tween.kill()
	_active_tween = null

	var target: Node2D = get_node("../Target") as Node2D

	# Reset Target to initial state.
	target.position = Vector2.ZERO
	target.rotation = 0.0
	target.scale = Vector2.ONE
	target.modulate = Color.WHITE

	_running = true

	var twn: Tween = create_tween()
	_active_tween = twn

	# ── Step 1: sequential, position (0,0) → (200,100), TRANS_LINEAR, 1.0s ──
	twn.tween_property(target, "position", Vector2(200, 100), 1.0) \
		.set_trans(Tween.TRANS_LINEAR)

	# Checkpoint: step_a_complete
	twn.tween_callback(_emit_step_a_complete)

	# ── Step 2: parallel block — scale (1,1)→(2,2) + modulate.a 1.0→0.5 ──
	# Both TRANS_LINEAR, 1.0s
	var par_2 := twn.parallel()
	par_2.tween_property(target, "scale", Vector2(2, 2), 1.0) \
		.set_trans(Tween.TRANS_LINEAR)
	par_2.tween_property(target, "modulate:a", 0.5, 1.0) \
		.set_trans(Tween.TRANS_LINEAR)

	# Checkpoint: step_b_complete
	twn.tween_callback(_emit_step_b_complete)

	# ── Step 3: sequential, rotation 0 → PI/2, TRANS_QUAD / EASE_OUT, 1.0s ──
	twn.tween_property(target, "rotation", PI / 2.0, 1.0) \
		.set_trans(Tween.TRANS_QUAD) \
		.set_ease(Tween.EASE_OUT)

	# Checkpoint: step_c_complete
	twn.tween_callback(_emit_step_c_complete)

	# ── Step 4: parallel block — modulate (1,1,1,1)→(0.5,1,1,1) ──
	# TRANS_CUBIC / EASE_IN, 0.5s
	var par_4 := twn.parallel()
	par_4.tween_property(target, "modulate", Color(0.5, 1.0, 1.0, 1.0), 0.5) \
		.from(Color.WHITE) \
		.set_trans(Tween.TRANS_CUBIC) \
		.set_ease(Tween.EASE_IN)

	# Checkpoint: animation_complete
	twn.tween_callback(_emit_animation_complete)

	return twn


## Returns false only after animation_complete has fired.
func is_running() -> bool:
	return _running


# ── internal emitters ────────────────────────────────────────────────

func _emit_step_a_complete() -> void:
	step_a_complete.emit()


func _emit_step_b_complete() -> void:
	step_b_complete.emit()


func _emit_step_c_complete() -> void:
	step_c_complete.emit()


func _emit_animation_complete() -> void:
	_running = false
	animation_complete.emit()
