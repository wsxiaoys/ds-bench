class_name NavWorld
extends Node2D

const WALKABLE_RECT := Rect2(0, 0, 800, 600)

@onready var _region: NavigationRegion2D = $Region
@onready var _obstacles: Node2D = $Obstacles
@onready var _agent: Node = $Agent
@onready var _goal: Marker2D = $Goal


func _ready() -> void:
    rebake_navigation()


func rebake_navigation() -> void:
    var source_geo := NavigationMeshSourceGeometryData2D.new()

    # Walkable area outline (traversable).
    var walkable_verts := PackedVector2Array([
        WALKABLE_RECT.position,
        WALKABLE_RECT.position + Vector2(WALKABLE_RECT.size.x, 0),
        WALKABLE_RECT.position + WALKABLE_RECT.size,
        WALKABLE_RECT.position + Vector2(0, WALKABLE_RECT.size.y),
    ])
    source_geo.add_traversable_outline(walkable_verts)

    # Obstruction outlines from each NavigationObstacle2D child.
    for child in _obstacles.get_children():
        if not (child is NavigationObstacle2D):
            continue
        var obstacle: NavigationObstacle2D = child
        var verts: PackedVector2Array = obstacle.vertices
        if verts.size() < 3:
            continue
        # Translate obstacle local vertices to world space.
        var world_verts := PackedVector2Array()
        var offset: Vector2 = obstacle.global_position
        for v in verts:
            world_verts.append(v + offset)
        source_geo.add_obstruction_outline(world_verts)

    # Bake into a new NavigationPolygon.
    var nav_poly := NavigationPolygon.new()
    NavigationServer2D.bake_from_source_geometry_data(nav_poly, source_geo)

    # Assign to the region so it takes effect.
    _region.navigation_polygon = nav_poly


func move_obstacle(obstacle_name: String, new_position: Vector2) -> void:
    var obstacle := _obstacles.get_node_or_null(obstacle_name) as NavigationObstacle2D
    if obstacle == null:
        push_error("NavWorld.move_obstacle: obstacle '%s' not found" % obstacle_name)
        return
    obstacle.global_position = new_position
    rebake_navigation()


func start_navigation() -> void:
    _agent.set_destination(_goal.global_position)
