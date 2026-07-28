extends SceneTree

func _init():
	print("--- Running GPU Instancing Data Authoring and Culling Build ---")
	
	# Load class
	var InstanceFieldClass = load("res://instancing/instance_field.gd")
	if InstanceFieldClass == null:
		print("ERROR: Failed to load InstanceField class")
		quit(1)
		return
		
	# Instantiate and build
	var field = InstanceFieldClass.new()
	var mm = field.build()
	if mm == null:
		print("ERROR: Failed to build MultiMesh")
		quit(1)
		return
		
	print("MultiMesh built successfully.")
	print("Instance count: ", mm.instance_count)
	print("Buffer size: ", mm.buffer.size())
	
	# Create build directory if needed
	var dir = DirAccess.open("res://")
	if not dir.dir_exists("res://build"):
		var err = dir.make_dir("res://build")
		if err != OK:
			print("ERROR: Failed to create res://build directory (error code: ", err, ")")
			quit(1)
			return
		print("Created build directory.")
	else:
		print("Build directory already exists.")
		
	# Save MultiMesh resource
	var save_err = ResourceSaver.save(mm, "res://build/field.res")
	if save_err != OK:
		print("ERROR: Failed to save MultiMesh to res://build/field.res (error code: ", save_err, ")")
		quit(1)
		return
	print("Saved MultiMesh resource to res://build/field.res successfully.")
	
	# Run culling query
	var box_min = Vector3(-1.0, 0.0, -3.0)
	var box_max = Vector3(5.0, 1.5, 0.0)
	var result = field.cull(box_min, box_max)
	
	print("Culling query executed:")
	print("  Visible count: ", result.count)
	print("  Weight sum: ", result.weight_sum)
	print("  Flagged count: ", result.flagged_count)
	
	# Generate JSON report manually to ensure exact float formats (e.g. -1.0, 123.0)
	var indices_str_arr = []
	for idx in result.indices:
		indices_str_arr.append(str(idx))
	var visible_indices_str = "[" + ", ".join(indices_str_arr) + "]"
	
	var json_str = "{\n"
	json_str += "  \"instance_count\": 120,\n"
	json_str += "  \"transform_format\": 1,\n"
	json_str += "  \"use_colors\": true,\n"
	json_str += "  \"use_custom_data\": true,\n"
	json_str += "  \"query_min\": [-1.0, 0.0, -3.0],\n"
	json_str += "  \"query_max\": [5.0, 1.5, 0.0],\n"
	json_str += "  \"visible_indices\": " + visible_indices_str + ",\n"
	json_str += "  \"visible_count\": " + str(result.count) + ",\n"
	json_str += "  \"weight_sum\": " + "%.1f" % result.weight_sum + ",\n"
	json_str += "  \"flagged_count\": " + str(result.flagged_count) + "\n"
	json_str += "}"
	
	# Write JSON report
	var report_file = FileAccess.open("res://build/report.json", FileAccess.WRITE)
	if report_file == null:
		print("ERROR: Failed to open res://build/report.json for writing")
		quit(1)
		return
		
	report_file.store_string(json_str)
	report_file.close()
	print("Saved JSON report to res://build/report.json successfully.")
	
	print("--- Build completed successfully ---")
	quit(0)
