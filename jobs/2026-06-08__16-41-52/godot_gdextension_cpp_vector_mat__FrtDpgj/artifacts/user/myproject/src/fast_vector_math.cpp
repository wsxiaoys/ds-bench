#include "fast_vector_math.h"

#include <godot_cpp/core/class_db.hpp>
#include <godot_cpp/variant/array.hpp>
#include <godot_cpp/variant/utility_functions.hpp>

namespace godot {

void FastVectorMath::_bind_methods() {
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("dot_product", "a", "b"), &FastVectorMath::dot_product);
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("cross_product", "a", "b"), &FastVectorMath::cross_product);
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("compute_centroid_and_bounds", "points"), &FastVectorMath::compute_centroid_and_bounds);
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("ray_sphere_intersection", "origin", "dir", "sphere_center", "radius"), &FastVectorMath::ray_sphere_intersection);
}

FastVectorMath::FastVectorMath() {}
FastVectorMath::~FastVectorMath() {}

double FastVectorMath::dot_product(const Vector3 &a, const Vector3 &b) {
	return a.x * b.x + a.y * b.y + a.z * b.z;
}

Vector3 FastVectorMath::cross_product(const Vector3 &a, const Vector3 &b) {
	return Vector3(
		a.y * b.z - a.z * b.y,
		a.z * b.x - a.x * b.z,
		a.x * b.y - a.y * b.x
	);
}

Array FastVectorMath::compute_centroid_and_bounds(const PackedVector3Array &points) {
	Array result;

	if (points.size() == 0) {
		result.append(Vector3());
		result.append(Vector3());
		result.append(Vector3());
		return result;
	}

	Vector3 centroid;
	Vector3 min_bounds = points[0];
	Vector3 max_bounds = points[0];

	for (int64_t i = 0; i < points.size(); i++) {
		const Vector3 &p = points[i];
		centroid.x += p.x;
		centroid.y += p.y;
		centroid.z += p.z;

		if (p.x < min_bounds.x) min_bounds.x = p.x;
		if (p.y < min_bounds.y) min_bounds.y = p.y;
		if (p.z < min_bounds.z) min_bounds.z = p.z;
		if (p.x > max_bounds.x) max_bounds.x = p.x;
		if (p.y > max_bounds.y) max_bounds.y = p.y;
		if (p.z > max_bounds.z) max_bounds.z = p.z;
	}

	double inv_count = 1.0 / (double)points.size();
	centroid.x *= inv_count;
	centroid.y *= inv_count;
	centroid.z *= inv_count;

	result.append(centroid);
	result.append(min_bounds);
	result.append(max_bounds);
	return result;
}

double FastVectorMath::ray_sphere_intersection(const Vector3 &origin, const Vector3 &dir, const Vector3 &sphere_center, double radius) {
	Vector3 oc = origin - sphere_center;
	double a = dir.x * dir.x + dir.y * dir.y + dir.z * dir.z;
	double b = 2.0 * (oc.x * dir.x + oc.y * dir.y + oc.z * dir.z);
	double c = oc.x * oc.x + oc.y * oc.y + oc.z * oc.z - radius * radius;
	double discriminant = b * b - 4.0 * a * c;

	if (discriminant < 0.0) {
		return -1.0;
	}

	double sqrt_disc = Math::sqrt(discriminant);
	double t0 = (-b - sqrt_disc) / (2.0 * a);
	double t1 = (-b + sqrt_disc) / (2.0 * a);

	if (t0 >= 0.0) {
		return t0;
	}
	if (t1 >= 0.0) {
		return t1;
	}
	return -1.0;
}

} // namespace godot
