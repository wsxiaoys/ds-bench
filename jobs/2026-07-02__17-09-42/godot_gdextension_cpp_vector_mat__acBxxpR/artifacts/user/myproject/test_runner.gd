extends SceneTree

func _initialize() -> void:
	var ok := true

	var fvm = ClassDB.instantiate("FastVectorMath")
	if fvm == null:
		printerr("FAIL: Could not instantiate FastVectorMath")
		quit(1)
		return

	# --- dot_product ---
	var dp := FastVectorMath.dot_product(Vector3(1, 2, 3), Vector3(4, 5, 6))
	if is_equal_approx(dp, 32.0):
		print("PASS: dot_product")
	else:
		printerr("FAIL: dot_product expected 32.0, got %s" % dp)
		ok = false

	# --- cross_product ---
	var cp := FastVectorMath.cross_product(Vector3(1, 0, 0), Vector3(0, 1, 0))
	if cp.is_equal_approx(Vector3(0, 0, 1)):
		print("PASS: cross_product")
	else:
		printerr("FAIL: cross_product expected (0,0,1), got %s" % cp)
		ok = false

	# --- compute_centroid_and_bounds ---
	var pts := PackedVector3Array([
		Vector3(0, 0, 0),
		Vector3(2, 0, 0),
		Vector3(0, 4, 0),
		Vector3(0, 0, 6),
	])
	var arr: Array = FastVectorMath.compute_centroid_and_bounds(pts)
	if arr.size() == 3 \
			and (arr[0] as Vector3).is_equal_approx(Vector3(0.5, 1.0, 1.5)) \
			and (arr[1] as Vector3).is_equal_approx(Vector3(0, 0, 0)) \
			and (arr[2] as Vector3).is_equal_approx(Vector3(2, 4, 6)):
		print("PASS: compute_centroid_and_bounds")
	else:
		printerr("FAIL: compute_centroid_and_bounds unexpected result: %s" % [arr])
		ok = false

	# --- ray_sphere_intersection ---
	# Two sub-cases combined into a single check:
	#   * Ray from origin along +X, sphere at (5,0,0) radius 1.0 -> hit at 4.0
	#   * Ray that misses entirely -> -1.0
	var hit := FastVectorMath.ray_sphere_intersection(
		Vector3(0, 0, 0), Vector3(1, 0, 0), Vector3(5, 0, 0), 1.0)
	var miss := FastVectorMath.ray_sphere_intersection(
		Vector3(0, 0, 0), Vector3(1, 0, 0), Vector3(0, 5, 0), 1.0)
	if is_equal_approx(hit, 4.0) and miss == -1.0:
		print("PASS: ray_sphere_intersection")
	else:
		printerr("FAIL: ray_sphere_intersection hit=%s miss=%s" % [hit, miss])
		ok = false

	if ok:
		print("ALL TESTS PASSED")
		quit(0)
	else:
		quit(1)
