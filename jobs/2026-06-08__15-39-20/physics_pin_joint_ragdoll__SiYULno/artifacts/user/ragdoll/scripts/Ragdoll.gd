class_name Ragdoll
extends Node2D

signal ragdoll_collapsed(avg_pos: Vector2)

var _parts: Array[RigidBody2D] = []
var _has_collapsed := false
var _rest_time := 0.0
var _prev_positions := {}

func _ready() -> void:
	for part_name in ["Head", "Torso", "LeftArm", "RightArm", "LeftLeg", "RightLeg"]:
		var part = get_node(NodePath(part_name)) as RigidBody2D
		if part:
			_parts.append(part)
			_prev_positions[part] = part.global_position

func get_part(name: StringName) -> RigidBody2D:
	return get_node(NodePath(name)) as RigidBody2D

func apply_impulse_to(part_name: StringName, impulse: Vector2) -> void:
	var part = get_part(part_name)
	if part:
		part.apply_central_impulse(impulse)

func freeze_all(freeze: bool) -> void:
	for part in _parts:
		part.freeze = freeze

func get_average_position() -> Vector2:
	if _parts.is_empty():
		return Vector2.ZERO
	var sum := Vector2.ZERO
	for part in _parts:
		sum += part.global_position
	return sum / _parts.size()

func _physics_process(delta: float) -> void:
	if _has_collapsed:
		return
	
	if _parts.is_empty():
		return
	
	var is_moving = false
	for part in _parts:
		var current_pos = part.global_position
		var prev_pos = _prev_positions[part]
		if current_pos.distance_to(prev_pos) > 0.5:
			is_moving = true
		_prev_positions[part] = current_pos
	
	if is_moving:
		_rest_time = 0.0
	else:
		_rest_time += delta
		if _rest_time >= 0.5:
			_has_collapsed = true
			ragdoll_collapsed.emit(get_average_position())
