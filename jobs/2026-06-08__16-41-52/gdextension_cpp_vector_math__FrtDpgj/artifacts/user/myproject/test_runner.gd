extends Node

func _ready():
	var all_passed = true

	# Check class exists
	if ClassDB.class_exists("FastVectorMath"):
		print("PASS: ClassDB.class_exists('FastVectorMath')")
	else:
		print("FAIL: ClassDB.class_exists('FastVectorMath')")
		all_passed = false

	# Instantiate via ClassDB
	var fvm = ClassDB.instantiate("FastVectorMath")
	if fvm != null:
		print("PASS: ClassDB.instantiate('FastVectorMath')")
	else:
		print("FAIL: ClassDB.instantiate('FastVectorMath')")
		all_passed = false

	# Test dot_product
	var a = Vector3(1.0, 2.0, 3.0)
	var b = Vector3(4.0, 5.0, 6.0)
	var dot = FastVectorMath.dot_product(a, b)
	var expected_dot = 1.0 * 4.0 + 2.0 * 5.0 + 3.0 * 6.0  # 32.0
	if is_equal_approx(dot, expected_dot):
		print("PASS: dot_product")
	else:
		print("FAIL: dot_product - got ", dot, " expected ", expected_dot)
		all_passed = false

	# Test cross_product
	var cross = FastVectorMath.cross_product(a, b)
	var expected_cross = Vector3(
		2.0 * 6.0 - 3.0 * 5.0,
		3.0 * 4.0 - 1.0 * 6.0,
		1.0 * 5.0 - 2.0 * 4.0
	)  # (-3, 6, -3)
	if cross.is_equal_approx(expected_cross):
		print("PASS: cross_product")
	else:
		print("FAIL: cross_product - got ", cross, " expected ", expected_cross)
		all_passed = false

	# Test compute_centroid_and_bounds
	var points = PackedVector3Array([
		Vector3(0.0, 0.0, 0.0),
		Vector3(2.0, 0.0, 0.0),
		Vector3(0.0, 2.0, 0.0),
		Vector3(0.0, 0.0, 2.0),
	])
	var result = FastVectorMath.compute_centroid_and_bounds(points)
	var centroid = result[0]
	var min_bounds = result[1]
	var max_bounds = result[2]
	var expected_centroid = Vector3(0.5, 0.5, 0.5)
	var expected_min = Vector3(0.0, 0.0, 0.0)
	var expected_max = Vector3(2.0, 2.0, 2.0)
	if centroid.is_equal_approx(expected_centroid) and min_bounds.is_equal_approx(expected_min) and max_bounds.is_equal_approx(expected_max):
		print("PASS: compute_centroid_and_bounds")
	else:
		print("FAIL: compute_centroid_and_bounds - got centroid=", centroid, " min=", min_bounds, " max=", max_bounds)
		all_passed = false

	# Test ray_sphere_intersection - hit
	var origin = Vector3(0.0, 0.0, -5.0)
	var dir = Vector3(0.0, 0.0, 1.0)
	var sphere_center = Vector3(0.0, 0.0, 0.0)
	var radius = 1.0
	var t = FastVectorMath.ray_sphere_intersection(origin, dir, sphere_center, radius)
	# Ray from (0,0,-5) along +Z hits sphere at center (0,0,0) radius 1
	# Distance should be 4.0 (the nearest positive t)
	if is_equal_approx(t, 4.0):
		print("PASS: ray_sphere_intersection (hit)")
	else:
		print("FAIL: ray_sphere_intersection (hit) - got ", t, " expected ", 4.0)
		all_passed = false

	# Test ray_sphere_intersection - miss
	var origin2 = Vector3(0.0, 0.0, -5.0)
	var dir2 = Vector3(0.0, 1.0, 0.0)  # pointing sideways, misses sphere
	var t_miss = FastVectorMath.ray_sphere_intersection(origin2, dir2, sphere_center, radius)
	if t_miss < 0.0:
		print("PASS: ray_sphere_intersection (miss)")
	else:
		print("FAIL: ray_sphere_intersection (miss) - got ", t_miss, " expected -1.0")
		all_passed = false

	if all_passed:
		print("ALL TESTS PASSED")
	else:
		print("SOME TESTS FAILED")

	get_tree().quit()
