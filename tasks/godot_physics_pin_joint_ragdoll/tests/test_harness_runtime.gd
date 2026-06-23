extends Node


const PART_NAMES := [
	"Head", "Torso", "LeftArm", "RightArm", "LeftLeg", "RightLeg",
]


func _ready() -> void:
	var packed: PackedScene = load("res://scenes/Ragdoll.tscn")
	if packed == null:
		printerr("FAIL: could not load res://scenes/Ragdoll.tscn")
		get_tree().quit(2)
		return

	var ragdoll := packed.instantiate()
	add_child(ragdoll)
	await get_tree().process_frame
	await get_tree().physics_frame

	# Required method presence checks.
	for m in ["apply_impulse_to", "freeze_all", "get_part", "get_average_position"]:
		if not ragdoll.has_method(m):
			printerr("FAIL: Ragdoll is missing required method '%s'" % m)
			get_tree().quit(3)
			return

	if not ragdoll.has_signal("ragdoll_collapsed"):
		printerr("FAIL: Ragdoll is missing signal 'ragdoll_collapsed'")
		get_tree().quit(4)
		return

	# 1) apply_impulse_to(&"Head", Vector2(0, -500)) -> head linear_velocity.y < -1.0
	ragdoll.call("apply_impulse_to", StringName("Head"), Vector2(0, -500))
	await get_tree().physics_frame

	var head_part: Node = ragdoll.call("get_part", StringName("Head"))
	if head_part == null:
		printerr("FAIL: get_part(&\"Head\") returned null")
		get_tree().quit(5)
		return
	if not (head_part is RigidBody2D):
		printerr("FAIL: get_part(&\"Head\") did not return a RigidBody2D, got %s" % head_part.get_class())
		get_tree().quit(6)
		return

	var vy: float = (head_part as RigidBody2D).linear_velocity.y
	if not (vy < -1.0):
		printerr("FAIL: head linear_velocity.y not < -1.0 after impulse; got %f" % vy)
		get_tree().quit(7)
		return

	# 2) freeze_all(true) -> all freeze == true
	ragdoll.call("freeze_all", true)
	await get_tree().physics_frame
	for part_name in PART_NAMES:
		var part: Node = ragdoll.call("get_part", StringName(part_name))
		if part == null:
			printerr("FAIL: get_part(&\"%s\") returned null" % part_name)
			get_tree().quit(8)
			return
		if not (part is RigidBody2D):
			printerr("FAIL: get_part(&\"%s\") is not a RigidBody2D" % part_name)
			get_tree().quit(9)
			return
		if not (part as RigidBody2D).freeze:
			printerr("FAIL: %s.freeze should be true after freeze_all(true)" % part_name)
			get_tree().quit(10)
			return

	# 3) freeze_all(false) -> all freeze == false
	ragdoll.call("freeze_all", false)
	await get_tree().physics_frame
	for part_name in PART_NAMES:
		var part2: Node = ragdoll.call("get_part", StringName(part_name))
		if not (part2 is RigidBody2D):
			printerr("FAIL: get_part(&\"%s\") is not a RigidBody2D" % part_name)
			get_tree().quit(11)
			return
		if (part2 as RigidBody2D).freeze:
			printerr("FAIL: %s.freeze should be false after freeze_all(false)" % part_name)
			get_tree().quit(12)
			return

	print("RUNTIME_HARNESS_OK")
	get_tree().quit(0)
