extends SceneTree

func _init():
	print("Starting FastVectorMath tests...")
	
	# Verify ClassDB has FastVectorMath
	if not ClassDB.class_exists("FastVectorMath"):
		print("FAILED: ClassDB.class_exists('FastVectorMath') returned false")
		quit(1)
		return
		
	# Instantiate class via ClassDB
	var fvm = ClassDB.instantiate("FastVectorMath")
	if fvm == null:
		print("FAILED: Could not instantiate FastVectorMath")
		quit(1)
		return
	
	# Test 1: dot_product
	var dot_res = fvm.dot_product(Vector3(1, 2, 3), Vector3(4, 5, 6))
	if is_equal_approx(dot_res, 32.0):
		print("PASS: dot_product")
	else:
		print("FAIL: dot_product. Expected 32.0, got ", dot_res)
		quit(1)
		return
		
	# Test 2: cross_product
	var cross_res = fvm.cross_product(Vector3(1, 0, 0), Vector3(0, 1, 0))
	if cross_res.is_equal_approx(Vector3(0, 0, 1)):
		print("PASS: cross_product")
	else:
		print("FAIL: cross_product. Expected (0, 0, 1), got ", cross_res)
		quit(1)
		return
		
	# Test 3: compute_centroid_and_bounds
	var pts = PackedVector3Array([Vector3(0, 0, 0), Vector3(2, 4, 6)])
	var cab_res = fvm.compute_centroid_and_bounds(pts)
	if cab_res.size() == 3 and cab_res[0].is_equal_approx(Vector3(1, 2, 3)) and cab_res[1].is_equal_approx(Vector3(0, 0, 0)) and cab_res[2].is_equal_approx(Vector3(2, 4, 6)):
		print("PASS: compute_centroid_and_bounds")
	else:
		print("FAIL: compute_centroid_and_bounds. Got ", cab_res)
		quit(1)
		return
		
	# Test 4: ray_sphere_intersection
	var hit_dist = fvm.ray_sphere_intersection(Vector3(0, 0, -5), Vector3(0, 0, 1), Vector3(0, 0, 0), 2.0)
	var miss_dist = fvm.ray_sphere_intersection(Vector3(0, 0, -5), Vector3(1, 0, 0), Vector3(0, 0, 0), 2.0)
	if is_equal_approx(hit_dist, 3.0) and is_equal_approx(miss_dist, -1.0):
		print("PASS: ray_sphere_intersection")
	else:
		print("FAIL: ray_sphere_intersection. Hit got ", hit_dist, ", miss got ", miss_dist)
		quit(1)
		return
		
	print("ALL TESTS PASSED")
	quit(0)
