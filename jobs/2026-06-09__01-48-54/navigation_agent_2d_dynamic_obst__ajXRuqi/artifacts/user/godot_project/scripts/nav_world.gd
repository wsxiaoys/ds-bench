extends Node2D
class_name NavWorld

@onready var region: NavigationRegion2D = $Region
@onready var obstacles: Node2D = $Obstacles
@onready var agent = $Agent
@onready var goal: Marker2D = $Goal

func _ready() -> void:
	rebake_navigation()

func rebake_navigation() -> void:
	var new_polygon := NavigationPolygon.new()
	var outline := PackedVector2Array([
		Vector2(0, 0),
		Vector2(800, 0),
		Vector2(800, 600),
		Vector2(0, 600)
	])
	new_polygon.add_outline(outline)
	
	var source_geometry := NavigationMeshSourceGeometryData2D.new()
	source_geometry.add_traversable_outline(outline)
	
	for child in obstacles.get_children():
		if child is NavigationObstacle2D:
			var obs_outline: PackedVector2Array = child.vertices
			var global_obs_outline := PackedVector2Array()
			for v in obs_outline:
				global_obs_outline.append(v + child.global_position)
			if global_obs_outline.size() > 0:
				source_geometry.add_obstruction_outline(global_obs_outline)
				
	NavigationServer2D.bake_from_source_geometry_data(new_polygon, source_geometry)
	region.navigation_polygon = new_polygon

func move_obstacle(obstacle_name: String, new_position: Vector2) -> void:
	var obs = obstacles.get_node(obstacle_name)
	if obs and obs is NavigationObstacle2D:
		obs.global_position = new_position
		rebake_navigation()

func start_navigation() -> void:
	agent.set_destination(goal.global_position)
