class_name Ragdoll
extends Node2D

signal ragdoll_collapsed(avg_pos: Vector2)

const PART_NAMES: Array[StringName] = [
    &"Head",
    &"Torso",
    &"LeftArm",
    &"RightArm",
    &"LeftLeg",
    &"RightLeg",
]

const SETTLED_TIME_THRESHOLD: float = 0.5
const MOVEMENT_THRESHOLD: float = 0.5

var _previous_positions: Dictionary = {}
var _settled_time: float = 0.0
var _has_emitted: bool = false

func _ready() -> void:
    set_physics_process(true)

func _physics_process(delta: float) -> void:
    if _has_emitted:
        return

    var all_stable: bool = true
    for part_name in PART_NAMES:
        var part: RigidBody2D = get_part(part_name)
        if part == null:
            continue
        var current_pos: Vector2 = part.global_position
        if _previous_positions.has(part_name):
            var prev_pos: Vector2 = _previous_positions[part_name]
            if current_pos.distance_to(prev_pos) > MOVEMENT_THRESHOLD:
                all_stable = false
        _previous_positions[part_name] = current_pos

    if all_stable and _previous_positions.size() == PART_NAMES.size():
        _settled_time += delta
        if _settled_time >= SETTLED_TIME_THRESHOLD:
            _has_emitted = true
            ragdoll_collapsed.emit(get_average_position())
    else:
        _settled_time = 0.0

func apply_impulse_to(part_name: StringName, impulse: Vector2) -> void:
    var part: RigidBody2D = get_part(part_name)
    if part != null:
        part.apply_central_impulse(impulse)

func freeze_all(freeze: bool) -> void:
    for part_name in PART_NAMES:
        var part: RigidBody2D = get_part(part_name)
        if part != null:
            part.freeze = freeze

func get_part(name: StringName) -> RigidBody2D:
    return get_node_or_null(NodePath(String(name))) as RigidBody2D

func get_average_position() -> Vector2:
    var sum: Vector2 = Vector2.ZERO
    var count: int = 0
    for part_name in PART_NAMES:
        var part: RigidBody2D = get_part(part_name)
        if part != null:
            sum += part.global_position
            count += 1
    if count == 0:
        return Vector2.ZERO
    return sum / float(count)
