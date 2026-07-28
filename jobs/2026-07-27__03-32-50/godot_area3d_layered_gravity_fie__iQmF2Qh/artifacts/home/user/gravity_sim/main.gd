extends Node3D

const SAMPLE_TICKS := [40, 80, 120, 160, 200, 240]
const TOTAL_TICKS := 240
const LAYER_BIT_1 := 1  # collision_layer/mask value for "bit 1" (1 << 0)

var tick_count := 0
var probe: RigidBody3D
var samples := []
var finished := false

func _ready() -> void:
	_build_scene()

func _build_scene() -> void:
	# --- Probe (RigidBody3D) ---
	probe = RigidBody3D.new()
	probe.name = "Probe"
	add_child(probe)

	probe.mass = 1.0
	probe.gravity_scale = 1.0
	probe.linear_damp_mode = RigidBody3D.DAMP_MODE_REPLACE
	probe.angular_damp_mode = RigidBody3D.DAMP_MODE_REPLACE
	probe.linear_damp = 0.0
	probe.angular_damp = 0.0
	probe.can_sleep = false
	probe.sleeping = false
	probe.collision_layer = LAYER_BIT_1
	probe.collision_mask = 0
	probe.continuous_cd = false

	var probe_shape := SphereShape3D.new()
	probe_shape.radius = 0.5
	var probe_cshape := CollisionShape3D.new()
	probe_cshape.shape = probe_shape
	probe.add_child(probe_cshape)

	probe.global_position = Vector3.ZERO
	probe.linear_velocity = Vector3(40, 0, 0)
	probe.angular_velocity = Vector3.ZERO

	# --- Gravity fields ---
	# Field A: Combine, directional +X, magnitude 3.0, priority 0
	_add_field(
		"FieldA",
		Vector3(225, 0, 0), Vector3(600, 2000, 2000),
		Area3D.SPACE_OVERRIDE_COMBINE,
		false, Vector3(1, 0, 0),
		3.0, 0,
		Vector3.ZERO, 0.0
	)

	# Field B: Replace-Combine, directional +Y, magnitude 9.0, priority 10
	_add_field(
		"FieldB",
		Vector3(30, 0, 0), Vector3(40, 2000, 2000),
		Area3D.SPACE_OVERRIDE_REPLACE_COMBINE,
		false, Vector3(0, 1, 0),
		9.0, 10,
		Vector3.ZERO, 0.0
	)

	# Field C: Combine-Replace, directional +Z, magnitude 7.0, priority 20
	_add_field(
		"FieldC",
		Vector3(90, 0, 0), Vector3(60, 2000, 2000),
		Area3D.SPACE_OVERRIDE_COMBINE_REPLACE,
		false, Vector3(0, 0, 1),
		7.0, 20,
		Vector3.ZERO, 0.0
	)

	# Field D: Replace, point gravity toward global (200, 25, 0), magnitude 15.0, priority 30
	var field_d_center := Vector3(200, 0, 0)
	var target_point := Vector3(200, 25, 0)
	# Area3D's gravity_point_center is expressed in the area's own local space and
	# combined with the area's transform by the physics engine, so convert the
	# desired *global* attraction point into that local space.
	var local_point_center := target_point - field_d_center
	_add_field(
		"FieldD",
		field_d_center, Vector3(160, 2000, 2000),
		Area3D.SPACE_OVERRIDE_REPLACE,
		true, Vector3.ZERO,
		15.0, 30,
		local_point_center, 0.0
	)

func _add_field(
	node_name: String,
	center: Vector3,
	size: Vector3,
	override_mode: int,
	is_point: bool,
	direction: Vector3,
	magnitude: float,
	priority: int,
	point_center: Vector3,
	unit_distance: float
) -> void:
	var area := Area3D.new()
	area.name = node_name
	add_child(area)

	area.global_position = center
	area.gravity_space_override = override_mode
	area.gravity_point = is_point
	if is_point:
		area.gravity_point_center = point_center
		area.gravity_point_unit_distance = unit_distance
	else:
		area.gravity_direction = direction
	area.gravity = magnitude
	area.priority = priority

	area.collision_layer = LAYER_BIT_1
	area.collision_mask = LAYER_BIT_1
	area.monitorable = true
	area.monitoring = true

	var box := BoxShape3D.new()
	box.size = size
	var cshape := CollisionShape3D.new()
	cshape.shape = box
	area.add_child(cshape)

func _physics_process(_delta: float) -> void:
	if finished:
		return

	tick_count += 1

	if tick_count in SAMPLE_TICKS:
		samples.append({
			"step": tick_count,
			"position": [probe.global_position.x, probe.global_position.y, probe.global_position.z],
			"velocity": [probe.linear_velocity.x, probe.linear_velocity.y, probe.linear_velocity.z],
		})

	if tick_count >= TOTAL_TICKS:
		finished = true
		_write_results()
		get_tree().quit()

func _write_results() -> void:
	if not DirAccess.dir_exists_absolute("res://output"):
		DirAccess.make_dir_absolute("res://output")

	var data := {
		"physics_ticks_per_second": Engine.physics_ticks_per_second,
		"samples": samples,
	}

	var json_string := JSON.stringify(data, "  ", true, true)

	var f := FileAccess.open("res://output/result.json", FileAccess.WRITE)
	f.store_string(json_string)
	f.close()
