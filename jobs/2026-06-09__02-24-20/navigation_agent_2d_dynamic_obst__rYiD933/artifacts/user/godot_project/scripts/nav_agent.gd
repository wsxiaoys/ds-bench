class_name NavAgent
extends CharacterBody2D

@export var movement_speed: float = 200.0

var reached: bool = false:
    set(value):
        reached = value
        if not value:
            _has_destination = false

@onready var _nav_agent: NavigationAgent2D = $NavigationAgent2D

var _has_destination: bool = false


func _ready() -> void:
    _nav_agent.target_reached.connect(_on_target_reached)


func set_destination(world_position: Vector2) -> void:
    _nav_agent.target_position = world_position
    _has_destination = true


func _physics_process(_delta: float) -> void:
    # Wait until the navigation map is ready (iteration_id > 0).
    # This avoids querying stale data before the first bake completes.
    var map_rid: RID = _nav_agent.get_navigation_map()
    if NavigationServer2D.map_get_iteration_id(map_rid) == 0:
        return

    if _nav_agent.is_navigation_finished():
        return

    var next_pos: Vector2 = _nav_agent.get_next_path_position()
    var dir: Vector2 = global_position.direction_to(next_pos)
    velocity = dir * movement_speed

    move_and_slide()


func _on_target_reached() -> void:
    # Only mark as reached if we actually had a destination to go to.
    if _has_destination:
        reached = true
