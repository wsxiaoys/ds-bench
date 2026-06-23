class_name Ragdoll
extends Node2D

signal ragdoll_collapsed(avg_pos: Vector2)

const PART_NAMES: Array[StringName] = [
	&"Head", &"Torso", &"LeftArm", &"RightArm", &"LeftLeg", &"RightLeg"
]

# Rest-detection state
const REST_THRESHOLD: float = 0.5       # pixels per frame
const REST_DURATION: float = 0.5        # seconds of stillness required

var _prev_positions: Dictionary = {}    # StringName -> Vector2
var _rest_timer: float = 0.0
var _collapsed_emitted: bool = false

func _ready() -> void:
	# Capture initial positions on first physics frame
	set_physics_process(true)
	for pname in PART_NAMES:
		var body := get_part(pname)
		if body:
			_prev_positions[pname] = body.global_position

func _physics_process(delta: float) -> void:
	if _collapsed_emitted:
		return

	var all_still := true
	for pname in PART_NAMES:
		var body := get_part(pname)
		if body == null:
			all_still = false
			break
		var prev: Vector2 = _prev_positions.get(pname, body.global_position)
		var moved: float = body.global_position.distance_to(prev)
		_prev_positions[pname] = body.global_position
		if moved > REST_THRESHOLD:
			all_still = false

	if all_still:
		_rest_timer += delta
	else:
		_rest_timer = 0.0

	if _rest_timer >= REST_DURATION:
		_collapsed_emitted = true
		ragdoll_collapsed.emit(get_average_position())

# ── Public API ───────────────────────────────────────────────────────────────

func apply_impulse_to(part_name: StringName, impulse: Vector2) -> void:
	var body := get_part(part_name)
	if body:
		body.apply_central_impulse(impulse)

func freeze_all(freeze: bool) -> void:
	for pname in PART_NAMES:
		var body := get_part(pname)
		if body:
			body.freeze = freeze

func get_part(name: StringName) -> RigidBody2D:
	return get_node_or_null(NodePath(name)) as RigidBody2D

func get_average_position() -> Vector2:
	var sum := Vector2.ZERO
	var count := 0
	for pname in PART_NAMES:
		var body := get_part(pname)
		if body:
			sum += body.global_position
			count += 1
	if count == 0:
		return Vector2.ZERO
	return sum / float(count)
