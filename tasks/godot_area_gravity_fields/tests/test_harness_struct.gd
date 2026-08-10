extends Node

# Verifies the scene structure and the exact gravity-field configuration by
# reading node properties directly (robust against .tscn formatting choices).

const EPS_POS := 1.0
const EPS_VAL := 0.5
const EPS_DIR := 0.01


func _fail(msg: String, code: int) -> void:
	printerr("FAIL: %s" % msg)
	get_tree().quit(code)


func _collect(node: Node, cls: String, out: Array) -> void:
	if node.is_class(cls):
		out.append(node)
	for c in node.get_children():
		_collect(c, cls, out)


func _v_ok(a: Vector2, b: Vector2, eps: float) -> bool:
	return absf(a.x - b.x) <= eps and absf(a.y - b.y) <= eps


func _rect_size(area: Node) -> Vector2:
	for c in area.get_children():
		if c is CollisionShape2D:
			var shp = (c as CollisionShape2D).shape
			if shp is RectangleShape2D:
				return (shp as RectangleShape2D).size
	return Vector2(-1, -1)


func _ready() -> void:
	var packed: PackedScene = load("res://scenes/GravityLab.tscn")
	if packed == null:
		_fail("could not load res://scenes/GravityLab.tscn", 2)
		return
	var root: Node = packed.instantiate()
	add_child(root)
	await get_tree().process_frame

	if not (root is Node2D):
		_fail("scene root must be a Node2D", 3)
		return
	if not root.has_method("net_gravity_at"):
		_fail("scene root must expose a net_gravity_at() method", 4)
		return

	# Collect Area2D nodes.
	var areas: Array = []
	_collect(root, "Area2D", areas)
	if areas.size() != 6:
		_fail("expected exactly 6 Area2D nodes, found %d" % areas.size(), 5)
		return

	var by_name := {}
	for a in areas:
		by_name[String(a.name)] = a

	# name -> [gpos, size, priority, override, is_point, gravity, dir_or_center]
	var spec := {
		"FieldGlobalDown": [Vector2(0, 500), Vector2(4000, 4000), 10, Area2D.SPACE_OVERRIDE_COMBINE, false, 200.0, Vector2(0, 1)],
		"FieldPushRight":  [Vector2(0, 300), Vector2(3000, 2000), 30, Area2D.SPACE_OVERRIDE_REPLACE_COMBINE, false, 300.0, Vector2(1, 0)],
		"FieldExtraDown":  [Vector2(0, 300), Vector2(3000, 2000), 20, Area2D.SPACE_OVERRIDE_COMBINE, false, 100.0, Vector2(0, 1)],
		"FieldWell":       [Vector2(800, -400), Vector2(600, 600), 40, Area2D.SPACE_OVERRIDE_REPLACE, true, 400.0, Vector2(800, -400)],
		"FieldPushLeft":   [Vector2(-900, -400), Vector2(600, 600), 50, Area2D.SPACE_OVERRIDE_COMBINE_REPLACE, false, 250.0, Vector2(-1, 0)],
		"FieldHighDown":   [Vector2(1600, 300), Vector2(600, 800), 35, Area2D.SPACE_OVERRIDE_COMBINE, false, 500.0, Vector2(0, 1)],
	}

	for nm in spec.keys():
		if not by_name.has(nm):
			_fail("missing Area2D named '%s'" % nm, 6)
			return
		var area = by_name[nm]
		var s = spec[nm]
		if not _v_ok(area.global_position, s[0], EPS_POS):
			_fail("%s global_position %s != expected %s" % [nm, str(area.global_position), str(s[0])], 7)
			return
		var sz: Vector2 = _rect_size(area)
		if not _v_ok(sz, s[1], EPS_POS):
			_fail("%s RectangleShape2D size %s != expected %s" % [nm, str(sz), str(s[1])], 8)
			return
		if int(area.priority) != int(s[2]):
			_fail("%s priority %d != expected %d" % [nm, int(area.priority), int(s[2])], 9)
			return
		if int(area.gravity_space_override) != int(s[3]):
			_fail("%s gravity_space_override %d != expected %d" % [nm, int(area.gravity_space_override), int(s[3])], 10)
			return
		if bool(area.gravity_point) != bool(s[4]):
			_fail("%s gravity_point %s != expected %s" % [nm, str(area.gravity_point), str(s[4])], 11)
			return
		if absf(float(area.gravity) - float(s[5])) > EPS_VAL:
			_fail("%s gravity %f != expected %f" % [nm, float(area.gravity), float(s[5])], 12)
			return
		if bool(s[4]):
			# Point field: world attraction center and constant magnitude.
			var world_center: Vector2 = area.to_global(area.gravity_point_center)
			if not _v_ok(world_center, s[6], EPS_POS):
				_fail("%s world gravity point center %s != expected %s" % [nm, str(world_center), str(s[6])], 13)
				return
			if absf(float(area.gravity_point_unit_distance)) > EPS_VAL:
				_fail("%s gravity_point_unit_distance must be 0.0, got %f" % [nm, float(area.gravity_point_unit_distance)], 14)
				return
		else:
			if not _v_ok(area.gravity_direction, s[6], EPS_DIR):
				_fail("%s gravity_direction %s != expected %s" % [nm, str(area.gravity_direction), str(s[6])], 15)
				return

	# Probe RigidBody2D.
	var bodies: Array = []
	_collect(root, "RigidBody2D", bodies)
	if bodies.size() != 1:
		_fail("expected exactly 1 RigidBody2D, found %d" % bodies.size(), 16)
		return
	var probe = bodies[0]
	if String(probe.name) != "Probe":
		_fail("the RigidBody2D must be named 'Probe', got '%s'" % String(probe.name), 17)
		return
	if not _v_ok(probe.global_position, Vector2(0, 0), EPS_POS):
		_fail("Probe must start at global position (0, 0), got %s" % str(probe.global_position), 18)
		return
	var has_shape := false
	for c in probe.get_children():
		if c is CollisionShape2D and (c as CollisionShape2D).shape != null:
			has_shape = true
	if not has_shape:
		_fail("Probe must have a CollisionShape2D child with a non-null shape", 19)
		return

	print("STRUCT_HARNESS_OK")
	get_tree().quit(0)
