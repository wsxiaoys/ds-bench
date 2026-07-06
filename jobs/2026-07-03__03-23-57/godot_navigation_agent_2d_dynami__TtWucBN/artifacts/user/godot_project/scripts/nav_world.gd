extends Node2D

func _ready() -> void:
    rebake_navigation()

func rebake_navigation() -> void:
    var region = get_node("Region")
    var nav_poly = region.navigation_polygon
    if nav_poly == null:
        nav_poly = NavigationPolygon.new()
        region.navigation_polygon = nav_poly
    
    nav_poly.cell_size = 1.0
    nav_poly.agent_radius = 10.0
    
    var source_data = NavigationMeshSourceGeometryData2D.new()
    
    # Walkable area from (0, 0) to (800, 600)
    var walkable_outline = PackedVector2Array([
        Vector2(0, 0),
        Vector2(800, 0),
        Vector2(800, 600),
        Vector2(0, 600)
    ])
    source_data.add_traversable_outline(walkable_outline)
    
    # Add obstacles
    var obstacles_node = get_node_or_null("Obstacles")
    if obstacles_node:
        for child in obstacles_node.get_children():
            if child is NavigationObstacle2D:
                var local_vertices = child.vertices
                if local_vertices.size() >= 3:
                    var world_vertices = PackedVector2Array()
                    for v in local_vertices:
                        world_vertices.append(v + child.global_position)
                    source_data.add_obstruction_outline(world_vertices)
                    
    NavigationServer2D.bake_from_source_geometry_data(nav_poly, source_data)
    
    # Re-assign to trigger the navigation region update
    region.navigation_polygon = nav_poly

func move_obstacle(obstacle_name: String, new_pos: Vector2) -> void:
    var obstacles_node = get_node("Obstacles")
    if obstacles_node:
        var obstacle = obstacles_node.get_node_or_null(obstacle_name)
        if obstacle:
            obstacle.global_position = new_pos
            rebake_navigation()

func start_navigation() -> void:
    var agent = get_node("Agent")
    var goal = get_node("Goal")
    if agent and goal:
        agent.call("set_destination", goal.global_position)
