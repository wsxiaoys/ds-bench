extends SceneTree

const SCENE_PATH := "res://scenes/nav_world.tscn"
const GOAL_POSITION := Vector2(720, 300)
const AGENT_START := Vector2(80, 300)
const GOAL_REACH_RADIUS := 40.0
const MAX_PHYSICS_TICKS := 1200  # 20 seconds at 60 ticks/sec

var results := {"assertions": {}, "errors": []}

func _initialize() -> void:
    _bootstrap.call_deferred()

func _bootstrap() -> void:
    await process_frame
    await physics_frame

    if not ResourceLoader.exists(SCENE_PATH):
        _record("scene_loads", false, {"err": "Scene does not exist at %s" % SCENE_PATH})
        _save_results()
        quit()
        return

    var packed: PackedScene = load(SCENE_PATH)
    if packed == null:
        _record("scene_loads", false, {"err": "Failed to load %s" % SCENE_PATH})
        _save_results()
        quit()
        return

    var world: Node = packed.instantiate()
    if world == null:
        _record("scene_loads", false, {"err": "Failed to instantiate scene"})
        _save_results()
        quit()
        return

    root.add_child(world)
    # Allow _ready and the first navigation bake to propagate.
    for i in range(10):
        await physics_frame

    _test_scene_structure(world)
    _test_nav_agent_api(world)
    _test_nav_world_api(world)
    await _test_reach_goal_with_obstacles(world)
    await _test_reach_goal_after_move(world)

    _save_results()
    quit()

func _record(test_name: String, ok: bool, info: Dictionary = {}) -> void:
    results.assertions[test_name] = {"passed": ok, "info": info}
    var status := "PASS" if ok else "FAIL"
    print("[%s] %s — %s" % [status, test_name, str(info)])

func _test_scene_structure(world: Node) -> void:
    var ok := true
    var info := {}

    if not (world is Node2D):
        ok = false
        info["root_type"] = "Root node is not Node2D"

    var region := world.get_node_or_null("Region")
    if not (region is NavigationRegion2D):
        ok = false
        info["region"] = "Missing or wrong type"

    var agent := world.get_node_or_null("Agent")
    if not (agent is CharacterBody2D):
        ok = false
        info["agent"] = "Missing or not CharacterBody2D"
    else:
        var nav_agent: Node = agent.get_node_or_null("NavigationAgent2D")
        if not (nav_agent is NavigationAgent2D):
            ok = false
            info["nav_agent_child"] = "NavigationAgent2D child missing"

    var obstacles := world.get_node_or_null("Obstacles")
    if obstacles == null:
        ok = false
        info["obstacles"] = "Missing Obstacles container"
    else:
        var o1: Node = obstacles.get_node_or_null("Obstacle1")
        var o2: Node = obstacles.get_node_or_null("Obstacle2")
        if not (o1 is NavigationObstacle2D):
            ok = false
            info["obstacle1"] = "Missing or not NavigationObstacle2D"
        elif o1.vertices.size() < 3:
            ok = false
            info["obstacle1_vertices"] = "vertices array has fewer than 3 entries"
        if not (o2 is NavigationObstacle2D):
            ok = false
            info["obstacle2"] = "Missing or not NavigationObstacle2D"
        elif o2.vertices.size() < 3:
            ok = false
            info["obstacle2_vertices"] = "vertices array has fewer than 3 entries"

    var goal := world.get_node_or_null("Goal")
    if not (goal is Marker2D):
        ok = false
        info["goal"] = "Missing or not Marker2D"
    else:
        if goal.global_position.distance_to(GOAL_POSITION) > 0.5:
            ok = false
            info["goal_pos"] = "Expected %s, got %s" % [str(GOAL_POSITION), str(goal.global_position)]

    _record("scene_structure_valid", ok, info)

func _test_nav_agent_api(world: Node) -> void:
    var ok := true
    var info := {}
    var agent := world.get_node_or_null("Agent")
    if agent == null:
        ok = false
        info["agent"] = "missing"
    else:
        if not agent.has_method("set_destination"):
            ok = false
            info["set_destination"] = "method missing"
        var reached_val = agent.get("reached")
        if typeof(reached_val) != TYPE_BOOL:
            ok = false
            info["reached"] = "property missing or not bool (got %s)" % typeof(reached_val)
        var speed_val = agent.get("movement_speed")
        if typeof(speed_val) != TYPE_FLOAT and typeof(speed_val) != TYPE_INT:
            ok = false
            info["movement_speed"] = "property missing or not numeric (got %s)" % typeof(speed_val)
    _record("nav_agent_api_present", ok, info)

func _test_nav_world_api(world: Node) -> void:
    var ok := true
    var info := {}
    if not world.has_method("rebake_navigation"):
        ok = false
        info["rebake_navigation"] = "missing"
    if not world.has_method("move_obstacle"):
        ok = false
        info["move_obstacle"] = "missing"
    if not world.has_method("start_navigation"):
        ok = false
        info["start_navigation"] = "missing"
    _record("nav_world_api_present", ok, info)

func _reset_agent(world: Node) -> void:
    var agent := world.get_node("Agent")
    agent.global_position = AGENT_START
    agent.velocity = Vector2.ZERO
    agent.set("reached", false)
    var nav_agent: NavigationAgent2D = agent.get_node("NavigationAgent2D")
    # Force a fresh path query next tick.
    nav_agent.target_position = AGENT_START

func _wait_for_map_sync() -> void:
    # Give the NavigationServer a few ticks to synchronize bakes.
    for i in range(6):
        await physics_frame

func _simulate(agent: Node2D, goal: Node2D, max_ticks: int) -> Dictionary:
    var reached := false
    var min_dist: float = INF
    var final_pos: Vector2 = agent.global_position
    for i in range(max_ticks):
        await physics_frame
        final_pos = agent.global_position
        var dist: float = final_pos.distance_to(goal.global_position)
        if dist < min_dist:
            min_dist = dist
        if agent.get("reached") == true:
            reached = true
            break
        if dist <= GOAL_REACH_RADIUS:
            # Even if signal didn't fire yet, finish soon.
            reached = (agent.get("reached") == true)
            if reached:
                break
    return {"reached": reached, "final_pos": final_pos, "min_dist": min_dist}

func _test_reach_goal_with_obstacles(world: Node) -> void:
    var agent: Node2D = world.get_node("Agent")
    var goal: Node2D = world.get_node("Goal")
    _reset_agent(world)
    await _wait_for_map_sync()
    world.call("start_navigation")
    await _wait_for_map_sync()
    var sim: Dictionary = await _simulate(agent, goal, MAX_PHYSICS_TICKS)
    var final_pos: Vector2 = sim["final_pos"]
    var dist: float = final_pos.distance_to(goal.global_position)
    var reached: bool = bool(sim["reached"])
    var ok: bool = reached and dist <= GOAL_REACH_RADIUS
    _record("agent_reaches_goal_with_obstacles", ok, {
        "reached": reached,
        "final_pos": str(final_pos),
        "dist": dist,
        "min_dist": sim["min_dist"],
    })

func _test_reach_goal_after_move(world: Node) -> void:
    var agent: Node2D = world.get_node("Agent")
    var goal: Node2D = world.get_node("Goal")
    var far := Vector2(-9000, -9000)
    world.call("move_obstacle", "Obstacle1", far)
    world.call("move_obstacle", "Obstacle2", far)
    await _wait_for_map_sync()
    _reset_agent(world)
    await _wait_for_map_sync()
    world.call("start_navigation")
    await _wait_for_map_sync()
    var sim: Dictionary = await _simulate(agent, goal, MAX_PHYSICS_TICKS)
    var final_pos: Vector2 = sim["final_pos"]
    var dist: float = final_pos.distance_to(goal.global_position)
    var reached: bool = bool(sim["reached"])
    var ok: bool = reached and dist <= GOAL_REACH_RADIUS
    _record("agent_reaches_goal_after_obstacles_moved", ok, {
        "reached": reached,
        "final_pos": str(final_pos),
        "dist": dist,
        "min_dist": sim["min_dist"],
    })

func _save_results() -> void:
    var path := "res://test_results.json"
    var f := FileAccess.open(path, FileAccess.WRITE)
    if f == null:
        push_error("Cannot open results file at %s" % path)
        return
    f.store_string(JSON.stringify(results, "  "))
    f.close()
