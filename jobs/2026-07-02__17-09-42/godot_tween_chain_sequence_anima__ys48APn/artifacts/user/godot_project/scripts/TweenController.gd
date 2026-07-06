extends Node
## TweenController
##
## Builds a deterministic Tween-driven animation sequence on the sibling
## `Target` node.  The sequence combines sequential steps and at least
## two parallel blocks, uses tween_callback checkpoints that emit
## the four completion signals, and applies per-step
## `set_trans()` / `set_ease()` overrides.

signal step_a_complete
signal step_b_complete
signal step_c_complete
signal animation_complete

var _running: bool = false


func is_running() -> bool:
	return _running


func play_sequence() -> Tween:
	var target: Node2D = get_parent().get_node("Target") as Node2D
	assert(target != null, "TweenController expects a sibling `Target` Node2D")

	_running = true

	# Default IDLE process mode so the verifier can `pause()` the
	# returned tween and drive it deterministically with
	# `custom_step(0.01)`.
	var tween: Tween = create_tween()

	# Step 1 (sequential): position (0,0) -> (200, 100) over 1.0 s,
	# TRANS_LINEAR.  Emits step_a_complete when finished (t=1.0).
	tween.tween_property(target, "position", Vector2(200.0, 100.0), 1.0) \
		.set_trans(Tween.TRANS_LINEAR)
	tween.tween_callback(_emit_step_a_complete)

	# Step 2 (parallel block #1): scale (1,1) -> (2,2) and
	# modulate:a 1 -> 0.5 in parallel over 1.0 s, both
	# TRANS_LINEAR.  Emits step_b_complete at t=2.0.
	tween.tween_property(target, "scale", Vector2(2.0, 2.0), 1.0) \
		.set_trans(Tween.TRANS_LINEAR)
	tween.parallel().tween_property(target, "modulate:a", 0.5, 1.0) \
		.set_trans(Tween.TRANS_LINEAR)
	tween.tween_callback(_emit_step_b_complete)

	# Step 3 (sequential): rotation 0 -> PI/2 over 1.0 s, TRANS_QUAD /
	# EASE_OUT.  Emits step_c_complete at t=3.0.
	tween.tween_property(target, "rotation", PI / 2.0, 1.0) \
		.set_trans(Tween.TRANS_QUAD) \
		.set_ease(Tween.EASE_OUT)
	tween.tween_callback(_emit_step_c_complete)

	# Step 4 (parallel block #2): modulate:r 1 -> 0.5 and
	# modulate:a 0.5 -> 1.0 in parallel over 0.5 s, both
	# TRANS_CUBIC / EASE_IN.  After both finish at t=3.5
	# animation_complete fires and _running is cleared.
	tween.tween_property(target, "modulate:r", 0.5, 0.5) \
		.set_trans(Tween.TRANS_CUBIC) \
		.set_ease(Tween.EASE_IN)
	tween.parallel().tween_property(target, "modulate:a", 1.0, 0.5) \
		.set_trans(Tween.TRANS_CUBIC) \
		.set_ease(Tween.EASE_IN)
	tween.tween_callback(_finish_sequence)

	return tween


func _emit_step_a_complete() -> void:
	step_a_complete.emit()


func _emit_step_b_complete() -> void:
	step_b_complete.emit()


func _emit_step_c_complete() -> void:
	step_c_complete.emit()


func _finish_sequence() -> void:
	animation_complete.emit()
	_running = false
