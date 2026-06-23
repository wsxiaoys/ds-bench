#ifndef FAST_VECTOR_MATH_H
#define FAST_VECTOR_MATH_H

#include <godot_cpp/classes/ref_counted.hpp>
#include <godot_cpp/variant/vector3.hpp>
#include <godot_cpp/variant/packed_vector3_array.hpp>
#include <godot_cpp/variant/array.hpp>

using namespace godot;

class FastVectorMath : public RefCounted {
    GDCLASS(FastVectorMath, RefCounted);

protected:
    static void _bind_methods();

public:
    static float dot_product(const Vector3 &a, const Vector3 &b);
    static Vector3 cross_product(const Vector3 &a, const Vector3 &b);
    static Array compute_centroid_and_bounds(const PackedVector3Array &points);
    static float ray_sphere_intersection(const Vector3 &origin, const Vector3 &dir, const Vector3 &sphere_center, float radius);
};

#endif // FAST_VECTOR_MATH_H