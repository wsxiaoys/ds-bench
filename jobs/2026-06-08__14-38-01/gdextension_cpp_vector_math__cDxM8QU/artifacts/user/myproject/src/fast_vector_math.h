#ifndef FAST_VECTOR_MATH_H
#define FAST_VECTOR_MATH_H

#include <godot_cpp/classes/ref_counted.hpp>
#include <godot_cpp/variant/vector3.hpp>
#include <godot_cpp/variant/packed_vector3_array.hpp>
#include <godot_cpp/variant/array.hpp>

namespace godot {

class FastVectorMath : public RefCounted {
	GDCLASS(FastVectorMath, RefCounted);

protected:
	static void _bind_methods();

public:
	FastVectorMath();
	~FastVectorMath();

	static float dot_product(const Vector3 &p_a, const Vector3 &p_b);
	static Vector3 cross_product(const Vector3 &p_a, const Vector3 &p_b);
	static Array compute_centroid_and_bounds(const PackedVector3Array &p_points);
	static float ray_sphere_intersection(const Vector3 &p_origin, const Vector3 &p_dir, const Vector3 &p_sphere_center, float p_radius);
};

} // namespace godot

#endif // FAST_VECTOR_MATH_H
