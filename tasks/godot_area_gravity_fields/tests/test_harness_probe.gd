extends Node

# Verifies net_gravity_at() against the reference resolution at both the
# documented positions and additional undisclosed interior positions.

const EPS := 0.5


func _fail(msg: String, code: int) -> void:
	printerr("FAIL: %s" % msg)
	get_tree().quit(code)


func _ready() -> void:
	var packed: PackedScene = load("res://scenes/GravityLab.tscn")
	if packed == null:
		_fail("could not load res://scenes/GravityLab.tscn", 2)
		return
	var root: Node = packed.instantiate()
	add_child(root)
	await get_tree().process_frame

	if not root.has_method("net_gravity_at"):
		_fail("scene root must expose a net_gravity_at() method", 3)
		return

	# [world_pos, expected_net_gravity]
	var cases := [
		[Vector2(0, 0), Vector2(300, 400)],
		[Vector2(900, -300), Vector2(-282.842712, -282.842712)],
		[Vector2(-900, -300), Vector2(-250, 0)],
		[Vector2(1700, 300), Vector2(0, 800)],
		[Vector2(1400, 300), Vector2(300, 400)],
		[Vector2(3000, 0), Vector2(0, 100)],
		[Vector2(0, 2000), Vector2(0, 300)],
		# undisclosed interior probes
		[Vector2(300, 900), Vector2(300, 400)],
		[Vector2(-1000, -300), Vector2(-250, 0)],
		[Vector2(1000, -300), Vector2(-357.770876, -178.885438)],
		[Vector2(1600, 300), Vector2(0, 800)],
		[Vector2(0, -2000), Vector2(0, 100)],
		[Vector2(1750, 600), Vector2(0, 800)],
		[Vector2(-400, 1100), Vector2(300, 400)],
	]

	for case in cases:
		var pos: Vector2 = case[0]
		var expected: Vector2 = case[1]
		var got = root.call("net_gravity_at", pos)
		if not (got is Vector2):
			_fail("net_gravity_at(%s) did not return a Vector2" % str(pos), 4)
			return
		var g: Vector2 = got
		if absf(g.x - expected.x) > EPS or absf(g.y - expected.y) > EPS:
			_fail("net_gravity_at(%s) = %s, expected %s (eps %f)" % [str(pos), str(g), str(expected), EPS], 5)
			return

	print("PROBE_HARNESS_OK")
	get_tree().quit(0)
