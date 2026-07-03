extends CharacterBody2D

@export var movement_speed: float = 200.0
@export var arrival_distance: float = 8.0

var reached: bool = false

@onready var nav_agent: NavigationAgent2D = $NavigationAgent2D

func _ready() -> void:
	nav_agent.target_reached.connect(_on_target_reached)

func set_destination(target: Vector2) -> void:
	reached = false
	nav_agent.target_position = target

func _on_target_reached() -> void:
	reached = true

func _physics_process(_delta: float) -> void:
	if reached:
		velocity = Vector2.ZERO
		move_and_slide()
		return
	if nav_agent.is_navigation_finished():
		velocity = Vector2.ZERO
		move_and_slide()
		return
	var map_rid: RID = get_world_2d().navigation_map
	if NavigationServer2D.map_get_iteration_id(map_rid) == 0:
		velocity = Vector2.ZERO
		move_and_slide()
		return
	var next_pos: Vector2 = nav_agent.get_next_path_position()
	var dir: Vector2 = next_pos - global_position
	if dir.length() > arrival_distance:
		velocity = dir.normalized() * movement_speed
	else:
		velocity = dir
	move_and_slide()
