extends SceneTree
# test_runner.gd
# Headless test runner for the FastVectorMath GDExtension.
#
# Run with:
#   godot --headless --script res://test_runner.gd
#
# It instantiates the FastVectorMath class through ClassDB, exercises every
# exposed static method, prints one PASS line per method, and finally prints
# ALL TESTS PASSED when every check succeeds.

const EPSILON := 1e-5

var _all_passed := true


func _init() -> void:
	_run_tests()
	if _all_passed:
		print("ALL TESTS PASSED")
	quit(0 if _all_passed else 1)


func _run_tests() -> void:
	var fvm = ClassDB.instantiate("FastVectorMath")
	assert(fvm != null, "Failed to instantiate FastVectorMath via ClassDB")

	_check_dot_product(fvm)
	_check_cross_product(fvm)
	_check_compute_centroid_and_bounds(fvm)
	_check_ray_sphere_intersection(fvm)


func _check_dot_product(fvm) -> void:
	var a := Vector3(1.0, 2.0, 3.0)
	var b := Vector3(4.0, 5.0, 6.0)
	var expected := 1.0 * 4.0 + 2.0 * 5.0 + 3.0 * 6.0 # 32.0
	var got: float = fvm.dot_product(a, b)
	if _assert_eq_float(got, expected, "dot_product(%s, %s)" % [a, b]):
		print("PASS dot_product")


func _check_cross_product(fvm) -> void:
	var a := Vector3(1.0, 0.0, 0.0)
	var b := Vector3(0.0, 1.0, 0.0)
	var expected := Vector3(0.0, 0.0, 1.0)
	var got: Vector3 = fvm.cross_product(a, b)
	if _assert_eq_vec3(got, expected, "cross_product(%s, %s)" % [a, b]):
		print("PASS cross_product")


func _check_compute_centroid_and_bounds(fvm) -> void:
	var points := PackedVector3Array([
		Vector3(0.0, 0.0, 0.0),
		Vector3(2.0, 4.0, 6.0),
		Vector3(-2.0, -4.0, -6.0),
	])
	var result: Array = fvm.compute_centroid_and_bounds(points)
	assert(result.size() == 3, "compute_centroid_and_bounds should return 3 elements")

	var expected_centroid := Vector3(0.0, 0.0, 0.0)
	var expected_min := Vector3(-2.0, -4.0, -6.0)
	var expected_max := Vector3(2.0, 4.0, 6.0)

	var ok := true
	ok = ok and _assert_eq_vec3(result[0], expected_centroid, "centroid")
	ok = ok and _assert_eq_vec3(result[1], expected_min, "min_bounds")
	ok = ok and _assert_eq_vec3(result[2], expected_max, "max_bounds")
	if ok:
		print("PASS compute_centroid_and_bounds")


func _check_ray_sphere_intersection(fvm) -> void:
	var ok := true

	# Hit: ray starts in front of the sphere and travels toward it.
	var origin := Vector3(0.0, 0.0, -5.0)
	var dir := Vector3(0.0, 0.0, 1.0)
	var center := Vector3(0.0, 0.0, 0.0)
	var radius := 1.0
	var hit: float = fvm.ray_sphere_intersection(origin, dir, center, radius)
	# Nearest intersection at z = -1, which is 4 units ahead of the origin.
	ok = ok and _assert_eq_float(hit, 4.0, "ray hit distance")

	# Miss: ray passes far above the sphere.
	var miss: float = fvm.ray_sphere_intersection(Vector3(0.0, 5.0, -5.0), Vector3(0.0, 0.0, 1.0), center, radius)
	ok = ok and _assert_eq_float(miss, -1.0, "ray miss returns -1.0")

	if ok:
		print("PASS ray_sphere_intersection")


# --- assertion helpers -------------------------------------------------------

func _assert_eq_float(got: float, expected: float, label: String) -> bool:
	if abs(got - expected) <= EPSILON:
		return true
	_all_passed = false
	print("FAIL %s: expected %s, got %s" % [label, expected, got])
	return false


func _assert_eq_vec3(got: Vector3, expected: Vector3, label: String) -> bool:
	if abs(got.x - expected.x) <= EPSILON and abs(got.y - expected.y) <= EPSILON and abs(got.z - expected.z) <= EPSILON:
		return true
	_all_passed = false
	print("FAIL %s: expected %s, got %s" % [label, expected, got])
	return false