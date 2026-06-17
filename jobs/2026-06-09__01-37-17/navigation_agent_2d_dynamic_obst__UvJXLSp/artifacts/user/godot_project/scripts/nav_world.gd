extends Node2D
class_name NavWorld

@onready var region: NavigationRegion2D = $Region
@onready var obstacles_container: Node2D = $Obstacles
@onready var agent: CharacterBody2D = $Agent
@onready var goal: Marker2D = $Goal

func _ready() -> void:
	rebake_navigation()

func rebake_navigation() -> void:
	var src := NavigationMeshSourceGeometryData2D.new()
	var walkable_outline := PackedVector2Array([
		Vector2(0, 0),
		Vector2(800, 0),
		Vector2(800, 600),
		Vector2(0, 600)
	])
	src.add_traversable_outline(walkable_outline)
	
	if obstacles_container:
		for obstacle in obstacles_container.get_children():
			if obstacle is NavigationObstacle2D and obstacle.vertices.size() >= 3:
				var local_vertices = obstacle.vertices
				var world_vertices := PackedVector2Array()
				for v in local_vertices:
					world_vertices.append(v + obstacle.global_position)
				src.add_obstruction_outline(world_vertices)
	
	var navpoly := NavigationPolygon.new()
	navpoly.agent_radius = 10.0
	
	NavigationServer2D.bake_from_source_geometry_data(navpoly, src)
	region.navigation_polygon = navpoly

func move_obstacle(obstacle_name: String, new_position: Vector2) -> void:
	if obstacles_container:
		var obstacle = obstacles_container.get_node_or_null(obstacle_name)
		if obstacle is NavigationObstacle2D:
			obstacle.global_position = new_position
			rebake_navigation()

func start_navigation() -> void:
	if agent and goal:
		agent.set_destination(goal.global_position)
