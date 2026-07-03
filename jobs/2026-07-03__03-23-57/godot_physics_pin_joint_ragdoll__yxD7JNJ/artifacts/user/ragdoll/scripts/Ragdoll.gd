extends Node2D
class_name Ragdoll

signal ragdoll_collapsed(avg_pos: Vector2)

var _prev_positions: Dictionary = {}
var _settled_time: float = 0.0
var _collapsed_emitted: bool = false

func _physics_process(delta: float) -> void:
	if _collapsed_emitted:
		return
	
	var parts = [&"Head", &"Torso", &"LeftArm", &"RightArm", &"LeftLeg", &"RightLeg"]
	var all_parts_exist = true
	var moved_more_than_limit = false
	
	# Store current positions to compare
	var current_positions = {}
	for part_name in parts:
		var part = get_part(part_name)
		if part:
			current_positions[part_name] = part.global_position
		else:
			all_parts_exist = false
			
	if not all_parts_exist:
		return
		
	# If we have previous positions, check movement
	if _prev_positions.size() == parts.size():
		for part_name in parts:
			var prev_pos = _prev_positions[part_name]
			var curr_pos = current_positions[part_name]
			if prev_pos.distance_to(curr_pos) > 0.5:
				moved_more_than_limit = true
				break
	else:
		# First frame, we can't determine movement yet, so treat as moved to reset timer
		moved_more_than_limit = true

	_prev_positions = current_positions

	if moved_more_than_limit:
		_settled_time = 0.0
	else:
		_settled_time += delta
		if _settled_time >= 0.5:
			_collapsed_emitted = true
			ragdoll_collapsed.emit(get_average_position())

func apply_impulse_to(part_name: StringName, impulse: Vector2) -> void:
	var part = get_part(part_name)
	if part:
		part.apply_central_impulse(impulse)

func freeze_all(freeze: bool) -> void:
	var parts = [&"Head", &"Torso", &"LeftArm", &"RightArm", &"LeftLeg", &"RightLeg"]
	for part_name in parts:
		var part = get_part(part_name)
		if part:
			part.freeze = freeze

func get_part(part_name: StringName) -> RigidBody2D:
	return get_node_or_null(NodePath(part_name)) as RigidBody2D

func get_average_position() -> Vector2:
	var parts = [&"Head", &"Torso", &"LeftArm", &"RightArm", &"LeftLeg", &"RightLeg"]
	var total_pos = Vector2.ZERO
	var count = 0
	for part_name in parts:
		var part = get_part(part_name)
		if part:
			total_pos += part.global_position
			count += 1
	if count > 0:
		return total_pos / float(count)
	return Vector2.ZERO
