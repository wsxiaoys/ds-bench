extends SceneTree

## Headless build script: constructs the InstanceField MultiMesh, saves it,
## runs the required culling query, and writes the JSON report.
## Run with: godot --headless --path <project> --script res://tools/build.gd

const InstanceFieldScript := preload("res://instancing/instance_field.gd")

func _init() -> void:
	var dir := DirAccess.open("res://")
	if dir != null and not dir.dir_exists("build"):
		dir.make_dir_recursive("build")

	var field: RefCounted = InstanceFieldScript.new()
	var mm: MultiMesh = field.build()

	var save_err := ResourceSaver.save(mm, "res://build/field.res")
	if save_err != OK:
		push_error("Failed to save MultiMesh: %s" % save_err)

	var query_min := Vector3(-1.0, 0.0, -3.0)
	var query_max := Vector3(5.0, 1.5, 0.0)
	var result: Dictionary = field.cull(query_min, query_max)

	var report := {
		"instance_count": mm.instance_count,
		"transform_format": mm.transform_format,
		"use_colors": mm.use_colors,
		"use_custom_data": mm.use_custom_data,
		"query_min": [query_min.x, query_min.y, query_min.z],
		"query_max": [query_max.x, query_max.y, query_max.z],
		"visible_indices": result["indices"],
		"visible_count": result["count"],
		"weight_sum": result["weight_sum"],
		"flagged_count": result["flagged_count"],
	}

	var f := FileAccess.open("res://build/report.json", FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify(report, "\t"))
		f.close()
	else:
		push_error("Failed to open report.json for writing")

	print("Build complete. instance_count=%d visible_count=%d weight_sum=%f flagged_count=%d" % [
		mm.instance_count, result["count"], result["weight_sum"], result["flagged_count"]
	])

	quit()
