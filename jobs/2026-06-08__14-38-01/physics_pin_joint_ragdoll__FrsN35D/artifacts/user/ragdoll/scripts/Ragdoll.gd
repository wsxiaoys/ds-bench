class_name Ragdoll
extends Node2D

signal ragdoll_collapsed(avg_pos: Vector2)

var parts: Dictionary = {}
var prev_positions: Dictionary = {}
var rest_timer: float = 0.0
var signal_emitted: bool = false

func _ready() -> void:
	# Initialize parts
	for name in ["Head", "Torso", "LeftArm", "RightArm", "LeftLeg", "RightLeg"]:
		var node = get_node_or_null(name)
		if node is RigidBody2D:
			parts[StringName(name)] = node
			prev_positions[StringName(name)] = node.global_position
		else:
			push_error("Missing or invalid body part: " + name)

func get_part(name: StringName) -> RigidBody2D:
	return parts.get(name) as RigidBody2D

func apply_impulse_to(part_name: StringName, impulse: Vector2) -> void:
	var part = get_part(part_name)
	if part:
		part.apply_central_impulse(impulse)

func freeze_all(freeze: bool) -> void:
	for part in parts.values():
		part.freeze = freeze

func get_average_position() -> Vector2:
	if parts.is_empty():
		return Vector2.ZERO
	var sum: Vector2 = Vector2.ZERO
	for part in parts.values():
		sum += part.global_position
	return sum / parts.size()

func _physics_process(delta: float) -> void:
	if signal_emitted:
		return
	
	var all_at_rest = true
	for name in parts:
		var part = parts[name]
		var prev_pos = prev_positions[name]
		var curr_pos = part.global_position
		var dist = prev_pos.distance_to(curr_pos)
		if dist > 0.5:
			all_at_rest = false
		# Update prev_position for next frame
		prev_positions[name] = curr_pos
		
	if all_at_rest:
		rest_timer += delta
		if rest_timer >= 0.5:
			signal_emitted = true
			ragdoll_collapsed.emit(get_average_position())
	else:
		rest_timer = 0.0
