class_name Ragdoll
extends Node2D

## Emitted exactly once when the ragdoll has been at rest for [member SETTLED_TIME]
## seconds. Carries the centroid of the six body parts at the moment of collapse.
signal ragdoll_collapsed(avg_pos: Vector2)

## Names of the six body parts that compose the ragdoll.
const PART_NAMES: Array[StringName] = [
	&"Head",
	&"Torso",
	&"LeftArm",
	&"RightArm",
	&"LeftLeg",
	&"RightLeg",
]

## How long (in seconds) the ragdoll must remain still before collapsing.
const SETTLED_TIME: float = 0.5

## Per-physics-frame movement (in pixels) below which a part is considered
## to be at rest.
const MOVEMENT_THRESHOLD: float = 0.5

## Previous-frame [code]global_position[/code] of every body part.
var _previous_positions: Dictionary = {}

## Accumulated time (in seconds) the ragdoll has been still so far.
var _settled_time: float = 0.0

## Guards [signal ragdoll_collapsed] so it is emitted at most once.
var _collapse_emitted: bool = false


func _ready() -> void:
	# Seed the previous-position cache so that the first physics frame does
	# not trigger a spurious "movement" comparison.
	for part_name in PART_NAMES:
		var part := get_node_or_null(NodePath(String(part_name)))
		if part is RigidBody2D:
			_previous_positions[part_name] = (part as RigidBody2D).global_position


func _physics_process(delta: float) -> void:
	if _collapse_emitted:
		return

	var any_moved: bool = false
	for part_name in PART_NAMES:
		var part := get_node_or_null(NodePath(String(part_name)))
		if not (part is RigidBody2D):
			continue
		var body := part as RigidBody2D
		var prev: Vector2 = _previous_positions.get(part_name, body.global_position)
		if prev.distance_to(body.global_position) > MOVEMENT_THRESHOLD:
			any_moved = true
			break

	if any_moved:
		_settled_time = 0.0
	else:
		_settled_time += delta
		if _settled_time >= SETTLED_TIME:
			_collapse_emitted = true
			ragdoll_collapsed.emit(get_average_position())

	# Snapshot positions for the next physics frame.
	for part_name in PART_NAMES:
		var part := get_node_or_null(NodePath(String(part_name)))
		if part is RigidBody2D:
			_previous_positions[part_name] = (part as RigidBody2D).global_position


## Applies [param impulse] to the rigid body named [param part_name].
## Silently no-ops if no such body part exists.
func apply_impulse_to(part_name: StringName, impulse: Vector2) -> void:
	var part := get_part(part_name)
	if part != null:
		part.apply_central_impulse(impulse)


## Freezes or unfreezes every one of the six body parts.
func freeze_all(freeze: bool) -> void:
	for part_name in PART_NAMES:
		var part := get_part(part_name)
		if part != null:
			part.freeze = freeze


## Returns the [RigidBody2D] child with the given [param name], or [code]null[/code]
## if no such body part exists.
func get_part(name: StringName) -> RigidBody2D:
	var node := get_node_or_null(NodePath(String(name)))
	if node is RigidBody2D:
		return node
	return null


## Returns the centroid of the six body parts' [code]global_position[/code].
## Returns [code]Vector2.ZERO[/code] if no body parts exist.
func get_average_position() -> Vector2:
	var sum := Vector2.ZERO
	var count := 0
	for part_name in PART_NAMES:
		var part := get_part(part_name)
		if part != null:
			sum += part.global_position
			count += 1
	if count > 0:
		return sum / float(count)
	return Vector2.ZERO