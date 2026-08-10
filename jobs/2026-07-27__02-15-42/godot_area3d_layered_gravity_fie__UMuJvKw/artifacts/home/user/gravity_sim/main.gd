extends Node3D

var tick_counter = 0
var samples = []
var probe: RigidBody3D

func _ready():
	print("Initializing Gravity Simulation...")
	
	# Create areas
	var area_a = create_area("AreaA", Vector3(225, 0, 0), Vector3(600, 2000, 2000), Area3D.SPACE_OVERRIDE_COMBINE, 3.0, 0, false, Vector3(1, 0, 0), Vector3.ZERO)
	var area_b = create_area("AreaB", Vector3(30, 0, 0), Vector3(40, 2000, 2000), Area3D.SPACE_OVERRIDE_REPLACE_COMBINE, 9.0, 10, false, Vector3(0, 1, 0), Vector3.ZERO)
	var area_c = create_area("AreaC", Vector3(90, 0, 0), Vector3(60, 2000, 2000), Area3D.SPACE_OVERRIDE_COMBINE_REPLACE, 7.0, 20, false, Vector3(0, 0, 1), Vector3.ZERO)
	var area_d = create_area("AreaD", Vector3(200, 0, 0), Vector3(160, 2000, 2000), Area3D.SPACE_OVERRIDE_REPLACE, 15.0, 30, true, Vector3.ZERO, Vector3(0, 25, 0))
	
	add_child(area_a)
	add_child(area_b)
	add_child(area_c)
	add_child(area_d)
	
	# Create probe
	probe = RigidBody3D.new()
	probe.name = "Probe"
	probe.position = Vector3(0, 0, 0)
	probe.linear_velocity = Vector3(40, 0, 0)
	probe.mass = 1.0
	probe.gravity_scale = 1.0
	probe.linear_damp_mode = RigidBody3D.DAMP_MODE_REPLACE
	probe.linear_damp = 0.0
	probe.angular_damp_mode = RigidBody3D.DAMP_MODE_REPLACE
	probe.angular_damp = 0.0
	probe.can_sleep = false
	
	var col = CollisionShape3D.new()
	var sphere = SphereShape3D.new()
	sphere.radius = 0.5
	col.shape = sphere
	probe.add_child(col)
	
	# Set collision layers/masks
	probe.set_collision_layer_value(1, true)
	probe.set_collision_layer_value(2, true)
	probe.set_collision_mask_value(1, true)
	probe.set_collision_mask_value(2, true)
	
	add_child(probe)

func create_area(name: String, center: Vector3, size: Vector3, override_mode: int, gravity_mag: float, priority: int, is_point: bool, gravity_dir: Vector3, point_center: Vector3) -> Area3D:
	var area = Area3D.new()
	area.name = name
	area.position = center
	area.gravity_space_override = override_mode
	area.gravity = gravity_mag
	area.priority = priority
	area.gravity_point = is_point
	if is_point:
		area.gravity_point_center = point_center
		area.gravity_point_unit_distance = 0.0
	else:
		area.gravity_direction = gravity_dir
	
	var col = CollisionShape3D.new()
	var box = BoxShape3D.new()
	box.size = size
	col.shape = box
	area.add_child(col)
	
	# Set collision layers/masks
	area.set_collision_layer_value(1, true)
	area.set_collision_layer_value(2, true)
	area.set_collision_mask_value(1, true)
	area.set_collision_mask_value(2, true)
	
	return area

func _physics_process(delta):
	tick_counter += 1
	
	# Wait for the physics server to step this tick
	await get_tree().physics_frame
	
	# Record sample if needed
	if tick_counter in [40, 80, 120, 160, 200, 240]:
		var pos = probe.global_position
		var vel = probe.linear_velocity
		print("Sample at tick ", tick_counter, " - pos: ", pos, ", vel: ", vel)
		samples.append({
			"step": tick_counter,
			"position": [pos.x, pos.y, pos.z],
			"velocity": [vel.x, vel.y, vel.z]
		})
	
	if tick_counter == 240:
		write_output()
		get_tree().quit()

func write_output():
	var lines = []
	lines.append("{")
	lines.append("  \"physics_ticks_per_second\": 60,")
	lines.append("  \"samples\": [")
	for i in range(samples.size()):
		var s = samples[i]
		var step_val = s["step"]
		var pos_val = s["position"]
		var vel_val = s["velocity"]
		
		var pos_str = "[%s, %s, %s]" % [str(pos_val[0]), str(pos_val[1]), str(pos_val[2])]
		var vel_str = "[%s, %s, %s]" % [str(vel_val[0]), str(vel_val[1]), str(vel_val[2])]
		
		var line = "    { \"step\": %d, \"position\": %s, \"velocity\": %s }" % [step_val, pos_str, vel_str]
		if i < samples.size() - 1:
			line += ","
		lines.append(line)
	lines.append("  ]")
	lines.append("}")
	
	var dir = DirAccess.open("res://")
	if not dir.dir_exists("output"):
		dir.make_dir("output")
		
	var file = FileAccess.open("res://output/result.json", FileAccess.WRITE)
	if file:
		var json_str = "\n".join(lines)
		file.store_string(json_str)
		file.close()
		print("Successfully wrote res://output/result.json")
	else:
		print("Failed to open res://output/result.json for writing!")
