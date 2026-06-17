extends SceneTree

func _init():
    print("Testing FastVectorMath...")
    
    if not ClassDB.class_exists("FastVectorMath"):
        print("FAIL: FastVectorMath class does not exist!")
        quit(1)
        return
        
    var math = ClassDB.instantiate("FastVectorMath")
    
    var all_passed = true
    
    # Test dot_product
    var dp = FastVectorMath.dot_product(Vector3(1, 2, 3), Vector3(4, 5, 6))
    if is_equal_approx(dp, 32.0):
        print("PASS: dot_product")
    else:
        print("FAIL: dot_product. Expected 32.0, got ", dp)
        all_passed = false
        
    # Test cross_product
    var cp = FastVectorMath.cross_product(Vector3(1, 0, 0), Vector3(0, 1, 0))
    if cp.is_equal_approx(Vector3(0, 0, 1)):
        print("PASS: cross_product")
    else:
        print("FAIL: cross_product. Expected (0, 0, 1), got ", cp)
        all_passed = false
        
    # Test compute_centroid_and_bounds
    var points = PackedVector3Array([
        Vector3(0, 0, 0),
        Vector3(2, 0, 0),
        Vector3(0, 2, 0),
        Vector3(0, 0, 2),
        Vector3(2, 2, 2)
    ])
    var bounds = FastVectorMath.compute_centroid_and_bounds(points)
    var expected_centroid = Vector3(4.0/5.0, 4.0/5.0, 4.0/5.0)
    var expected_min = Vector3(0, 0, 0)
    var expected_max = Vector3(2, 2, 2)
    
    if bounds.size() == 3 and \
       bounds[0].is_equal_approx(expected_centroid) and \
       bounds[1].is_equal_approx(expected_min) and \
       bounds[2].is_equal_approx(expected_max):
        print("PASS: compute_centroid_and_bounds")
    else:
        print("FAIL: compute_centroid_and_bounds. Got ", bounds)
        all_passed = false
        
    # Test ray_sphere_intersection
    var dist = FastVectorMath.ray_sphere_intersection(Vector3(0, 0, 5), Vector3(0, 0, -1), Vector3(0, 0, 0), 2.0)
    if is_equal_approx(dist, 3.0):
        print("PASS: ray_sphere_intersection")
    else:
        print("FAIL: ray_sphere_intersection. Expected 3.0, got ", dist)
        all_passed = false
        
    if all_passed:
        print("ALL TESTS PASSED")
        quit(0)
    else:
        quit(1)
