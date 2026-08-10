extends Node

# Verifies the RigidBody2D "Probe" trajectory under the configured fields after
# a fixed number of physics ticks (physics runs at 60 Hz).

const EPS_POS := 25.0
const EPS_VEL := 15.0


func _fail(msg: String, code: int) -> void:
	printerr("FAIL: %s" % msg)
	get_tree().quit(code)


func _find(node: Node, cls: String, out: Array) -> void:
	if node.is_class(cls):
		out.append(node)
	for c in node.get_children():
		_find(c, cls, out)


func _ready() -> void:
	var packed: PackedScene = load("res://scenes/GravityLab.tscn")
	if packed == null:
		_fail("could not load res://scenes/GravityLab.tscn", 2)
		return
	var root: Node = packed.instantiate()
	add_child(root)
	await get_tree().process_frame

	var bodies: Array = []
	_find(root, "RigidBody2D", bodies)
	if bodies.size() != 1:
		_fail("expected exactly 1 RigidBody2D, found %d" % bodies.size(), 3)
		return
	var probe: RigidBody2D = bodies[0]
	if String(probe.name) != "Probe":
		_fail("the RigidBody2D must be named 'Probe'", 4)
		return
	if absf(probe.global_position.x) > 1.0 or absf(probe.global_position.y) > 1.0:
		_fail("Probe must start at (0, 0), got %s" % str(probe.global_position), 5)
		return

	var pos60 := Vector2.ZERO
	var vel60 := Vector2.ZERO
	var pos120 := Vector2.ZERO
	var vel120 := Vector2.ZERO

	for n in range(1, 121):
		await get_tree().physics_frame
		if n == 60:
			pos60 = probe.global_position
			vel60 = probe.linear_velocity
		elif n == 120:
			pos120 = probe.global_position
			vel120 = probe.linear_velocity

	var exp_pos60 := Vector2(152.5, 203.333)
	var exp_vel60 := Vector2(300, 400)
	var exp_pos120 := Vector2(605.0, 806.667)
	var exp_vel120 := Vector2(600, 800)

	if absf(pos60.x - exp_pos60.x) > EPS_POS or absf(pos60.y - exp_pos60.y) > EPS_POS:
		_fail("position after 60 ticks %s != expected %s (eps %f)" % [str(pos60), str(exp_pos60), EPS_POS], 6)
		return
	if absf(vel60.x - exp_vel60.x) > EPS_VEL or absf(vel60.y - exp_vel60.y) > EPS_VEL:
		_fail("velocity after 60 ticks %s != expected %s (eps %f)" % [str(vel60), str(exp_vel60), EPS_VEL], 7)
		return
	if absf(pos120.x - exp_pos120.x) > EPS_POS or absf(pos120.y - exp_pos120.y) > EPS_POS:
		_fail("position after 120 ticks %s != expected %s (eps %f)" % [str(pos120), str(exp_pos120), EPS_POS], 8)
		return
	if absf(vel120.x - exp_vel120.x) > EPS_VEL or absf(vel120.y - exp_vel120.y) > EPS_VEL:
		_fail("velocity after 120 ticks %s != expected %s (eps %f)" % [str(vel120), str(exp_vel120), EPS_VEL], 9)
		return

	print("TRAJ_HARNESS_OK")
	get_tree().quit(0)
