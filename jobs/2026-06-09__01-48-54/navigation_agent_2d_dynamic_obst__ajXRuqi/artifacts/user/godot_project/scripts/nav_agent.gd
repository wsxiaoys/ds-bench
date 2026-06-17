extends CharacterBody2D
class_name NavAgent

@export var movement_speed: float = 200.0
var reached: bool = false
@onready var nav_agent: NavigationAgent2D = $NavigationAgent2D

func _ready() -> void:
	nav_agent.target_reached.connect(_on_target_reached)

func _on_target_reached() -> void:
	reached = true

func set_destination(world_position: Vector2) -> void:
	reached = false
	nav_agent.target_position = world_position

func _physics_process(delta: float) -> void:
	if NavigationServer2D.map_get_iteration_id(nav_agent.get_navigation_map()) == 0:
		return
	
	if nav_agent.is_navigation_finished():
		return

	var next_path_position: Vector2 = nav_agent.get_next_path_position()
	var current_agent_position: Vector2 = global_position
	var new_velocity: Vector2 = (next_path_position - current_agent_position).normalized() * movement_speed
	
	velocity = new_velocity
	move_and_slide()
