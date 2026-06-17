## TweenController.gd
## Drives a Tween-based animation on the sibling "Target" node.
## The tween is returned paused from play_sequence() so that external
## verifiers can drive it via custom_step(0.01).
extends Node

# ---------------------------------------------------------------------------
# Signals
# ---------------------------------------------------------------------------

## Emitted once the first sequential step (position move) finishes.
signal step_a_complete()
## Emitted once the first parallel block (scale + alpha) finishes.
signal step_b_complete()
## Emitted once the rotation step finishes.
signal step_c_complete()
## Emitted when the full sequence has finished.
signal animation_complete()

# ---------------------------------------------------------------------------
# Private state
# ---------------------------------------------------------------------------

var _is_running: bool = false
var _target: Node2D = null

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

func _ready() -> void:
	_target = get_parent().get_node("Target") as Node2D


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

## Builds and returns the active Tween driving the animation on Target.
## The tween is left **paused** so the caller can drive it with custom_step().
func play_sequence() -> Tween:
	# Resolve _target lazily in case play_sequence() is called before _ready().
	if _target == null:
		_target = get_parent().get_node("Target") as Node2D
	assert(_target != null, "TweenController: 'Target' node not found.")

	# Reset Target to the documented initial state.
	_target.position = Vector2(0.0, 0.0)
	_target.rotation  = 0.0
	_target.scale     = Vector2(1.0, 1.0)
	_target.modulate  = Color(1.0, 1.0, 1.0, 1.0)

	_is_running = true

	# Create the tween via the SceneTree (NOT via node.create_tween()) so that
	# custom_step() works correctly for deterministic testing.
	# Node-bound tweens ignore custom_step() when paused; SceneTree-owned tweens
	# respond to custom_step() regardless of pause state.
	var tw: Tween = _target.get_tree().create_tween()
	tw.set_pause_mode(Tween.TWEEN_PAUSE_BOUND)

	# ------------------------------------------------------------------
	# Step 1  (sequential) — position (0,0) → (200,100), LINEAR, 1.0 s
	# ------------------------------------------------------------------
	tw.tween_property(_target, "position", Vector2(200.0, 100.0), 1.0) \
		.set_trans(Tween.TRANS_LINEAR) \
		.set_ease(Tween.EASE_IN_OUT)

	# Checkpoint A — fires once position tween finishes
	tw.tween_callback(_emit_step_a)

	# ------------------------------------------------------------------
	# Step 2  (parallel block) — scale + modulate.a, LINEAR, 1.0 s
	#   scale    (1,1) → (2,2)
	#   modulate.a  1.0 → 0.5
	# ------------------------------------------------------------------
	tw.tween_property(_target, "scale", Vector2(2.0, 2.0), 1.0) \
		.set_trans(Tween.TRANS_LINEAR) \
		.set_ease(Tween.EASE_IN_OUT)

	tw.parallel().tween_property(_target, "modulate:a", 0.5, 1.0) \
		.set_trans(Tween.TRANS_LINEAR) \
		.set_ease(Tween.EASE_IN_OUT)

	# Checkpoint B — fires once the parallel block finishes
	tw.tween_callback(_emit_step_b)

	# ------------------------------------------------------------------
	# Step 3  (sequential) — rotation 0 → π/2, QUAD/EASE_OUT, 1.0 s
	# ------------------------------------------------------------------
	tw.tween_property(_target, "rotation", PI / 2.0, 1.0) \
		.set_trans(Tween.TRANS_QUAD) \
		.set_ease(Tween.EASE_OUT)

	# Checkpoint C — fires once rotation tween finishes
	tw.tween_callback(_emit_step_c)

	# ------------------------------------------------------------------
	# Step 4  (parallel block) — modulate.r + modulate.a, CUBIC/EASE_IN, 0.5 s
	#   modulate.r  1.0 → 0.5   (final modulate = (0.5, 1.0, 1.0, 1.0))
	#   modulate.a  0.5 → 1.0   (restore alpha so final a == 1.0)
	# ------------------------------------------------------------------
	tw.tween_property(_target, "modulate:r", 0.5, 0.5) \
		.set_trans(Tween.TRANS_CUBIC) \
		.set_ease(Tween.EASE_IN)

	tw.parallel().tween_property(_target, "modulate:a", 1.0, 0.5) \
		.set_trans(Tween.TRANS_CUBIC) \
		.set_ease(Tween.EASE_IN)

	# Final checkpoint — sequence complete
	tw.tween_callback(_emit_animation_complete)

	# Leave the tween paused so the caller controls time via custom_step().
	tw.pause()

	return tw


## Returns false only after animation_complete has been emitted.
func is_running() -> bool:
	return _is_running


# ---------------------------------------------------------------------------
# Private callbacks (used as Tween checkpoints)
# ---------------------------------------------------------------------------

func _emit_step_a() -> void:
	step_a_complete.emit()

func _emit_step_b() -> void:
	step_b_complete.emit()

func _emit_step_c() -> void:
	step_c_complete.emit()

func _emit_animation_complete() -> void:
	_is_running = false
	animation_complete.emit()
