/**************************************************************************/
/*  fast_vector_math.h                                                    */
/**************************************************************************/
/* High-performance vector math helper exposed to GDScript via GDExtension. */

#ifndef FAST_VECTOR_MATH_H
#define FAST_VECTOR_MATH_H

#include <godot_cpp/classes/ref_counted.hpp>
#include <godot_cpp/variant/array.hpp>
#include <godot_cpp/variant/packed_vector3_array.hpp>
#include <godot_cpp/variant/vector3.hpp>

#include <godot_cpp/core/binder_common.hpp>

using namespace godot;

// FastVectorMath exposes a handful of high-performance vector math routines
// to GDScript. Every method is static so it can be called directly on the
// class without allocating an instance, although the class is still RefCounted
// and can be instantiated through ClassDB as well.
class FastVectorMath : public RefCounted {
	GDCLASS(FastVectorMath, RefCounted);

protected:
	static void _bind_methods();

public:
	FastVectorMath();
	~FastVectorMath();

	// Returns the dot product of two Vector3 values.
	static real_t dot_product(const Vector3 &p_a, const Vector3 &p_b);

	// Returns the cross product of two Vector3 values.
	static Vector3 cross_product(const Vector3 &p_a, const Vector3 &p_b);

	// Computes the centroid and the axis-aligned bounding box of a set of
	// points. Returns an Array of the form [centroid, min_bounds, max_bounds].
	static Array compute_centroid_and_bounds(const PackedVector3Array &p_points);

	// Computes the nearest positive intersection distance of a ray with a
	// sphere. Returns the hit distance or -1.0 on miss. The direction is
	// normalized internally so the returned value is a true world-space
	// distance.
	static real_t ray_sphere_intersection(const Vector3 &p_origin, const Vector3 &p_dir, const Vector3 &p_sphere_center, real_t p_radius);
};

#endif // FAST_VECTOR_MATH_H