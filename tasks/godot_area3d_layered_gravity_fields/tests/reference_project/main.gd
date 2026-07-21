extends Node3D

# Reference (oracle) implementation of the area3d_layered_gravity_fields task.
# It constructs the exact specified scene, steps physics with the fixed
# timestep, samples the probe at the required ticks, writes the results JSON,
# and quits. Because it runs on the same engine build as the solution, its
# trajectory is the ground truth to compare against.

const TOTAL_STEPS := 240
const SAMPLE_STEPS := [40, 80, 120, 160, 200, 240]

var _probe: RigidBody3D
var _step := 0
var _samples: Array = []
var _done := false


func _ready() -> void:
	_build_probe()
	_build_fields()


func _build_probe() -> void:
	_probe = RigidBody3D.new()
	_probe.mass = 1.0
	_probe.gravity_scale = 1.0
	_probe.linear_damp = 0.0
	_probe.angular_damp = 0.0
	_probe.can_sleep = false
	_probe.collision_layer = 1
	_probe.collision_mask = 0

	var cs := CollisionShape3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = 0.5
	cs.shape = sphere
	_probe.add_child(cs)
	add_child(_probe)

	_probe.global_position = Vector3(0, 0, 0)
	_probe.linear_velocity = Vector3(40, 0, 0)


func _make_directional_field(center: Vector3, size: Vector3, mode: int, direction: Vector3, magnitude: float, prio: int) -> void:
	var area := Area3D.new()
	area.gravity_space_override = mode
	area.gravity_point = false
	area.gravity_direction = direction
	area.gravity = magnitude
	area.priority = prio
	area.monitoring = true
	area.collision_layer = 0
	area.collision_mask = 1

	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	cs.shape = box
	area.add_child(cs)
	add_child(area)
	area.global_position = center


func _make_point_field(center: Vector3, size: Vector3, mode: int, attraction_global: Vector3, magnitude: float, prio: int) -> void:
	var area := Area3D.new()
	area.gravity_space_override = mode
	area.gravity_point = true
	area.gravity = magnitude
	area.gravity_point_unit_distance = 0.0
	area.priority = prio
	area.monitoring = true
	area.collision_layer = 0
	area.collision_mask = 1

	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	cs.shape = box
	area.add_child(cs)
	add_child(area)
	area.global_position = center
	# gravity_point_center is expressed in the area's local space; the engine
	# transforms it by the area transform. With an identity-basis area at
	# `center`, the world attraction point is `center + gravity_point_center`.
	area.gravity_point_center = attraction_global - center


func _build_fields() -> void:
	# Field A: Combine, directional +X, priority 0.
	_make_directional_field(Vector3(225, 0, 0), Vector3(600, 2000, 2000), Area3D.SPACE_OVERRIDE_COMBINE, Vector3(1, 0, 0), 3.0, 0)
	# Field B: Replace-Combine, directional +Y, priority 10.
	_make_directional_field(Vector3(30, 0, 0), Vector3(40, 2000, 2000), Area3D.SPACE_OVERRIDE_REPLACE_COMBINE, Vector3(0, 1, 0), 9.0, 10)
	# Field C: Combine-Replace, directional +Z, priority 20.
	_make_directional_field(Vector3(90, 0, 0), Vector3(60, 2000, 2000), Area3D.SPACE_OVERRIDE_COMBINE_REPLACE, Vector3(0, 0, 1), 7.0, 20)
	# Field D: Replace, point gravity toward (200, 25, 0), priority 30.
	_make_point_field(Vector3(200, 0, 0), Vector3(160, 2000, 2000), Area3D.SPACE_OVERRIDE_REPLACE, Vector3(200, 25, 0), 15.0, 30)


func _physics_process(_delta: float) -> void:
	if _done:
		return
	_step += 1
	if _step in SAMPLE_STEPS:
		var p := _probe.global_position
		var v := _probe.linear_velocity
		_samples.append({
			"step": _step,
			"position": [p.x, p.y, p.z],
			"velocity": [v.x, v.y, v.z],
		})
	if _step >= TOTAL_STEPS:
		_write_and_quit()


func _write_and_quit() -> void:
	_done = true
	var d := DirAccess.open("res://")
	if d != null and not d.dir_exists("output"):
		d.make_dir("output")
	var f := FileAccess.open("res://output/result.json", FileAccess.WRITE)
	f.store_string(JSON.stringify({
		"physics_ticks_per_second": 60,
		"samples": _samples,
	}))
	f.close()
	get_tree().quit()
