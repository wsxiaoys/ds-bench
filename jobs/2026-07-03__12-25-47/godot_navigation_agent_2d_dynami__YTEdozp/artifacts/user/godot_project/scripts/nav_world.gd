extends Node2D

@onready var region: NavigationRegion2D = $Region
@onready var agent: CharacterBody2D = $Agent
@onready var obstacles: Node2D = $Obstacles
@onready var goal: Marker2D = $Goal

const WALKABLE_MIN := Vector2(0, 0)
const WALKABLE_MAX := Vector2(800, 600)

func _ready() -> void:
	rebake_navigation()

func rebake_navigation() -> void:
	var nav_poly := NavigationPolygon.new()
	var outline := PackedVector2Array([
		WALKABLE_MIN,
		Vector2(WALKABLE_MAX.x, WALKABLE_MIN.y),
		WALKABLE_MAX,
		Vector2(WALKABLE_MIN.x, WALKABLE_MAX.y),
	])
	nav_poly.add_outline(outline)

	var geom := NavigationMeshSourceGeometryData2D.new()
	geom.add_traversable_outline(outline)

	for child in obstacles.get_children():
		if child is NavigationObstacle2D and child.vertices.size() >= 3:
			var world_outline := PackedVector2Array()
			for v in child.vertices:
				world_outline.push_back(v + child.global_position)
			geom.add_obstruction_outline(world_outline)

	var nav_map_rid := region.get_world_2d().navigation_map
	NavigationServer2D.bake_from_source_geometry_data(nav_poly, geom, nav_map_rid)
	region.navigation_polygon = nav_poly

	NavigationServer2D.map_force_update(nav_map_rid)

func move_obstacle(name: String, new_position: Vector2) -> void:
	var node := obstacles.get_node_or_null(name)
	if node == null:
		return
	node.global_position = new_position
	rebake_navigation()

func start_navigation() -> void:
	var nav_agent: NavigationAgent2D = agent.get_node("NavigationAgent2D")
	nav_agent.target_position = goal.global_position
	agent.set("reached", false)
	agent.set_destination(goal.global_position)
