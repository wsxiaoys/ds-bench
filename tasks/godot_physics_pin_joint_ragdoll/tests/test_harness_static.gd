extends Node


const REQUIRED_PART_NAMES := [
	"Head", "Torso", "LeftArm", "RightArm", "LeftLeg", "RightLeg",
]

const EXPECTED_PAIRS := [
	["Head", "Torso"],
	["LeftArm", "Torso"],
	["RightArm", "Torso"],
	["LeftLeg", "Torso"],
	["RightLeg", "Torso"],
]


func _ready() -> void:
	var packed: PackedScene = load("res://scenes/Ragdoll.tscn")
	if packed == null:
		printerr("FAIL: could not load res://scenes/Ragdoll.tscn")
		get_tree().quit(2)
		return

	var instance := packed.instantiate()
	if not (instance is Node2D):
		printerr("FAIL: Ragdoll.tscn root is not a Node2D, got %s" % instance.get_class())
		get_tree().quit(3)
		return

	add_child(instance)
	await get_tree().process_frame

	# Collect all RigidBody2D and PinJoint2D descendants of the ragdoll root.
	var bodies := {}
	var joints: Array = []
	_collect(instance, bodies, joints)

	# 6 body parts with the required names.
	for required_name in REQUIRED_PART_NAMES:
		if not bodies.has(required_name):
			printerr("FAIL: Missing RigidBody2D part named '%s'" % required_name)
			get_tree().quit(4)
			return

	if bodies.size() != REQUIRED_PART_NAMES.size():
		printerr("FAIL: Expected exactly %d RigidBody2D parts, found %d (names=%s)"
			% [REQUIRED_PART_NAMES.size(), bodies.size(), str(bodies.keys())])
		get_tree().quit(5)
		return

	# Each body must have a CollisionShape2D child with a non-null shape and
	# a ColorRect or Polygon2D visual placeholder somewhere underneath.
	for part_name in REQUIRED_PART_NAMES:
		var body: RigidBody2D = bodies[part_name]
		var shape_ok := false
		var visual_ok := false
		for child in body.get_children():
			if child is CollisionShape2D and child.shape != null:
				shape_ok = true
			if child is ColorRect or child is Polygon2D:
				visual_ok = true
		if not shape_ok:
			printerr("FAIL: %s has no CollisionShape2D child with a real shape" % part_name)
			get_tree().quit(6)
			return
		if not visual_ok:
			printerr("FAIL: %s has no ColorRect/Polygon2D visual placeholder child" % part_name)
			get_tree().quit(7)
			return

	# Exactly 5 PinJoint2D nodes.
	if joints.size() != 5:
		printerr("FAIL: Expected exactly 5 PinJoint2D nodes, found %d" % joints.size())
		get_tree().quit(8)
		return

	# Build set of unordered name pairs from joint.node_a/node_b NodePath.
	var got_pairs: Array = []
	for j in joints:
		var joint: PinJoint2D = j
		var na: NodePath = joint.node_a
		var nb: NodePath = joint.node_b
		if na.is_empty() or nb.is_empty():
			printerr("FAIL: PinJoint2D '%s' has empty node_a/node_b" % joint.name)
			get_tree().quit(9)
			return
		var a_node := joint.get_node_or_null(na)
		var b_node := joint.get_node_or_null(nb)
		if a_node == null or b_node == null:
			printerr("FAIL: PinJoint2D '%s' node_a/node_b do not resolve (a=%s b=%s)"
				% [joint.name, str(na), str(nb)])
			get_tree().quit(10)
			return
		if not (a_node is RigidBody2D) or not (b_node is RigidBody2D):
			printerr("FAIL: PinJoint2D '%s' endpoints are not both RigidBody2D" % joint.name)
			get_tree().quit(11)
			return
		var pair: Array = [String(a_node.name), String(b_node.name)]
		pair.sort()
		got_pairs.append(pair)

	# Compare pair set (multiset, order-insensitive within each pair).
	var expected: Array = []
	for p in EXPECTED_PAIRS:
		var sp: Array = p.duplicate()
		sp.sort()
		expected.append(sp)
	expected.sort()
	got_pairs.sort()

	if got_pairs != expected:
		printerr("FAIL: PinJoint2D wiring mismatch. Expected %s, got %s"
			% [str(expected), str(got_pairs)])
		get_tree().quit(12)
		return

	print("STATIC_HARNESS_OK")
	get_tree().quit(0)


func _collect(node: Node, bodies: Dictionary, joints: Array) -> void:
	for child in node.get_children():
		if child is RigidBody2D:
			bodies[String(child.name)] = child
		if child is PinJoint2D:
			joints.append(child)
		_collect(child, bodies, joints)
