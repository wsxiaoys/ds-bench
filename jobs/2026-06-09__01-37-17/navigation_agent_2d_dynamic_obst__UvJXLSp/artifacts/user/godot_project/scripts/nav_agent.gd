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
	if reached:
		return
	
	var map_rid = nav_agent.get_navigation_map()
	if not map_rid.is_valid() or NavigationServer2D.map_get_iteration_id(map_rid) == 0:
		return
		
	if nav_agent.is_navigation_finished():
		return

	var next_pos: Vector2 = nav_agent.get_next_path_position()
	var dir: Vector2 = (next_pos - global_position).normalized()
	velocity = dir * movement_speed
	move_and_slide()
