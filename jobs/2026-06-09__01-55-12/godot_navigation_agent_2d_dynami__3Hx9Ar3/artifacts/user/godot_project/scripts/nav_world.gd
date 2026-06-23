class_name NavWorld
extends Node2D

# Walkable rectangle bounds (world space).
const WALK_RECT_MIN := Vector2(0.0, 0.0)
const WALK_RECT_MAX := Vector2(800.0, 600.0)

@onready var _region: NavigationRegion2D = $Region
@onready var _obstacles_node: Node2D     = $Obstacles
# Typed as CharacterBody2D to avoid cross-script class dependency at parse time.
@onready var _agent: CharacterBody2D     = $Agent
@onready var _goal: Marker2D             = $Goal


func _ready() -> void:
	rebake_navigation()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

## Rebuild the NavigationPolygon from the walkable rectangle carved by each
## NavigationObstacle2D child, then assign back to the Region.
func rebake_navigation() -> void:
	var nav_poly := NavigationPolygon.new()
	var source_geom := NavigationMeshSourceGeometryData2D.new()

	# 1. Outer traversable area.
	source_geom.add_traversable_outline(PackedVector2Array([
		WALK_RECT_MIN,
		Vector2(WALK_RECT_MAX.x, WALK_RECT_MIN.y),
		WALK_RECT_MAX,
		Vector2(WALK_RECT_MIN.x, WALK_RECT_MAX.y),
	]))

	# 2. Obstruction outlines: translate each obstacle to world space.
	for child in _obstacles_node.get_children():
		if not (child is NavigationObstacle2D):
			continue
		var obstacle := child as NavigationObstacle2D
		var local_verts: PackedVector2Array = obstacle.vertices
		if local_verts.size() < 3:
			continue

		var pos: Vector2 = obstacle.global_position
		var world_verts := PackedVector2Array()
		world_verts.resize(local_verts.size())
		for i in local_verts.size():
			world_verts[i] = pos + local_verts[i]

		# Only carve obstacles that actually overlap the walkable rect.
		if _outline_intersects_rect(world_verts, WALK_RECT_MIN, WALK_RECT_MAX):
			source_geom.add_obstruction_outline(world_verts)

	# 3. Bake: triangulates traversable area minus obstructions.
	NavigationServer2D.bake_from_source_geometry_data(nav_poly, source_geom)

	# 4. Push the updated polygon to the Region / NavigationServer2D.
	_region.navigation_polygon = nav_poly


## Move the named obstacle and re-bake so the navigation mesh reflects the change.
func move_obstacle(obstacle_name: String, new_position: Vector2) -> void:
	var obstacle: Node = _obstacles_node.get_node_or_null(obstacle_name)
	if obstacle == null:
		push_error("NavWorld.move_obstacle: '%s' not found." % obstacle_name)
		return
	obstacle.global_position = new_position
	rebake_navigation()


## Tell the agent to navigate toward the Goal marker.
func start_navigation() -> void:
	_agent.call("set_destination", _goal.global_position)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

## Returns true if any vertex of the outline is inside the rect.
func _outline_intersects_rect(verts: PackedVector2Array, r_min: Vector2, r_max: Vector2) -> bool:
	for v in verts:
		if v.x > r_min.x and v.x < r_max.x and v.y > r_min.y and v.y < r_max.y:
			return true
	return false
