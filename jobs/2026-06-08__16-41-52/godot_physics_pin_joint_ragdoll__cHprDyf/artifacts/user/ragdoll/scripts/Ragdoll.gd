extends Node2D
class_name Ragdoll

signal ragdoll_collapsed(avg_pos: Vector2)

var _part_names: Array[StringName] = [
	&"Head",
	&"Torso",
	&"LeftArm",
	&"RightArm",
	&"LeftLeg",
	&"RightLeg",
]

var _emitted_collapsed := false
var _rest_timer := 0.0
var _prev_positions: Dictionary = {}
const REST_THRESHOLD := 0.5
const REST_DURATION := 0.5


func _physics_process(delta: float) -> void:
	if _emitted_collapsed:
		set_physics_process(false)
		return

	var all_still := true
	for part_name in _part_names:
		var body := get_part(part_name)
		if body == null:
			continue
		var current_pos := body.global_position
		if _prev_positions.has(part_name):
			var prev_pos: Vector2 = _prev_positions[part_name]
			if current_pos.distance_to(prev_pos) > REST_THRESHOLD:
				all_still = false
		_prev_positions[part_name] = current_pos

	if all_still:
		_rest_timer += delta
		if _rest_timer >= REST_DURATION:
			_emitted_collapsed = true
			ragdoll_collapsed.emit(get_average_position())
	else:
		_rest_timer = 0.0


func apply_impulse_to(part_name: StringName, impulse: Vector2) -> void:
	var body := get_part(part_name)
	if body:
		body.apply_central_impulse(impulse)


func freeze_all(freeze: bool) -> void:
	for part_name in _part_names:
		var body := get_part(part_name)
		if body:
			body.freeze = freeze


func get_part(name: StringName) -> RigidBody2D:
	return get_node_or_null(NodePath(name)) as RigidBody2D


func get_average_position() -> Vector2:
	var total := Vector2.ZERO
	var count := 0
	for part_name in _part_names:
		var body := get_part(part_name)
		if body:
			total += body.global_position
			count += 1
	if count == 0:
		return Vector2.ZERO
	return total / float(count)
