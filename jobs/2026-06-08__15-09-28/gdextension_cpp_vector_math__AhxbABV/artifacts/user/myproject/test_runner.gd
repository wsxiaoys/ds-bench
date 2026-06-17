extends SceneTree

func _init() -> void:
	var all_passed := true

	# ── Guard: extension must be loaded ──────────────────────────────────────
	if not ClassDB.class_exists("FastVectorMath"):
		print("FAIL: FastVectorMath class not found – extension did not load")
		quit(1)
		return

	var fvm = ClassDB.instantiate("FastVectorMath")

	# ── Test 1: dot_product ──────────────────────────────────────────────────
	var a := Vector3(1.0, 2.0, 3.0)
	var b := Vector3(4.0, 5.0, 6.0)
	var dot: float = fvm.dot_product(a, b)          # 1*4 + 2*5 + 3*6 = 32
	if absf(dot - 32.0) < 1e-5:
		print("PASS: dot_product")
	else:
		print("FAIL: dot_product  expected=32.0  got=", dot)
		all_passed = false

	# ── Test 2: cross_product ────────────────────────────────────────────────
	var ax := Vector3(1.0, 0.0, 0.0)
	var ay := Vector3(0.0, 1.0, 0.0)
	var cross: Vector3 = fvm.cross_product(ax, ay)  # (0,0,1)
	if cross.is_equal_approx(Vector3(0.0, 0.0, 1.0)):
		print("PASS: cross_product")
	else:
		print("FAIL: cross_product  expected=(0,0,1)  got=", cross)
		all_passed = false

	# ── Test 3: compute_centroid_and_bounds ──────────────────────────────────
	var pts := PackedVector3Array([
		Vector3(-1.0, -1.0, -1.0),
		Vector3( 1.0,  1.0,  1.0),
	])
	var cbd: Array = fvm.compute_centroid_and_bounds(pts)
	var centroid: Vector3  = cbd[0]
	var min_b: Vector3     = cbd[1]
	var max_b: Vector3     = cbd[2]
	if  centroid.is_equal_approx(Vector3(0.0, 0.0, 0.0)) and \
		min_b.is_equal_approx(Vector3(-1.0, -1.0, -1.0)) and \
		max_b.is_equal_approx(Vector3( 1.0,  1.0,  1.0)):
		print("PASS: compute_centroid_and_bounds")
	else:
		print("FAIL: compute_centroid_and_bounds  centroid=", centroid,
			"  min=", min_b, "  max=", max_b)
		all_passed = false

	# ── Test 4: ray_sphere_intersection ──────────────────────────────────────
	# Ray along +Z, sphere centred at (0,0,5) r=1 → hit at t=4
	var origin  := Vector3(0.0, 0.0, 0.0)
	var dir     := Vector3(0.0, 0.0, 1.0)
	var scenter := Vector3(0.0, 0.0, 5.0)
	var t: float = fvm.ray_sphere_intersection(origin, dir, scenter, 1.0)
	if absf(t - 4.0) < 1e-4:
		print("PASS: ray_sphere_intersection")
	else:
		print("FAIL: ray_sphere_intersection  expected=4.0  got=", t)
		all_passed = false

	# ── Summary ───────────────────────────────────────────────────────────────
	if all_passed:
		print("ALL TESTS PASSED")
		quit(0)
	else:
		print("SOME TESTS FAILED")
		quit(1)
