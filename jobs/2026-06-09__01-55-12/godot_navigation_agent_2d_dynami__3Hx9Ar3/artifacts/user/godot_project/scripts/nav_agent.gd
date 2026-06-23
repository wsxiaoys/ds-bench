class_name NavAgent
extends CharacterBody2D

## Movement speed in pixels per second.
@export var movement_speed: float = 200.0

## Becomes true once the NavigationAgent2D fires target_reached.
var reached: bool = false

@onready var _nav_agent: NavigationAgent2D = $NavigationAgent2D


func _ready() -> void:
	_nav_agent.target_reached.connect(_on_target_reached)
	# Ensure path-desired-distance and target-desired-distance are reasonable.
	_nav_agent.path_desired_distance = 8.0
	_nav_agent.target_desired_distance = 16.0


## Sets the NavigationAgent2D target position so path-finding begins.
func set_destination(world_position: Vector2) -> void:
	reached = false
	_nav_agent.target_position = world_position


func _physics_process(_delta: float) -> void:
	# Wait until the navigation map has been processed at least once.
	var map_rid: RID = _nav_agent.get_navigation_map()
	if not map_rid.is_valid():
		return
	if NavigationServer2D.map_get_iteration_id(map_rid) == 0:
		return

	if _nav_agent.is_navigation_finished():
		velocity = Vector2.ZERO
		return

	var next_pos: Vector2 = _nav_agent.get_next_path_position()
	var direction: Vector2 = (next_pos - global_position).normalized()
	velocity = direction * movement_speed
	move_and_slide()


func _on_target_reached() -> void:
	reached = true
	velocity = Vector2.ZERO
