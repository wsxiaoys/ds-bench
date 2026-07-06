extends CharacterBody2D

@export var movement_speed: float = 200.0
var reached: bool = false

@onready var nav_agent: NavigationAgent2D = $NavigationAgent2D

func _ready() -> void:
    # Set the target desired distance slightly smaller than GOAL_REACH_RADIUS (40.0)
    nav_agent.target_desired_distance = 30.0
    nav_agent.target_reached.connect(_on_target_reached)

func set_destination(destination: Vector2) -> void:
    nav_agent.target_position = destination
    reached = false

func _on_target_reached() -> void:
    reached = true

func _physics_process(_delta: float) -> void:
    var map_rid = nav_agent.get_navigation_map()
    if map_rid == RID() or NavigationServer2D.map_get_iteration_id(map_rid) == 0:
        return

    if reached:
        velocity = Vector2.ZERO
        return

    var next_path_pos = nav_agent.get_next_path_position()
    var current_pos = global_position
    var direction = current_pos.direction_to(next_path_pos)
    
    velocity = direction * movement_speed
    move_and_slide()
