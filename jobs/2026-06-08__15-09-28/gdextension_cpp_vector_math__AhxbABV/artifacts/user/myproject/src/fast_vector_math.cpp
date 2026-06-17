#include "fast_vector_math.h"

#include <godot_cpp/core/class_db.hpp>
#include <cmath>

using namespace godot;

void FastVectorMath::_bind_methods() {
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("dot_product", "a", "b"), &FastVectorMath::dot_product);
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("cross_product", "a", "b"), &FastVectorMath::cross_product);
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("compute_centroid_and_bounds", "points"), &FastVectorMath::compute_centroid_and_bounds);
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("ray_sphere_intersection", "origin", "dir", "sphere_center", "radius"), &FastVectorMath::ray_sphere_intersection);
}

float FastVectorMath::dot_product(const Vector3 &a, const Vector3 &b) {
	return a.x * b.x + a.y * b.y + a.z * b.z;
}

Vector3 FastVectorMath::cross_product(const Vector3 &a, const Vector3 &b) {
	return Vector3(
			a.y * b.z - a.z * b.y,
			a.z * b.x - a.x * b.z,
			a.x * b.y - a.y * b.x);
}

Array FastVectorMath::compute_centroid_and_bounds(const PackedVector3Array &points) {
	Array result;

	int64_t count = points.size();
	if (count == 0) {
		result.push_back(Vector3());
		result.push_back(Vector3());
		result.push_back(Vector3());
		return result;
	}

	Vector3 centroid(0.0f, 0.0f, 0.0f);
	Vector3 min_bounds = points[0];
	Vector3 max_bounds = points[0];

	for (int64_t i = 0; i < count; i++) {
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

	float inv = 1.0f / static_cast<float>(count);
	centroid.x *= inv;
	centroid.y *= inv;
	centroid.z *= inv;

	result.push_back(centroid);
	result.push_back(min_bounds);
	result.push_back(max_bounds);
	return result;
}

float FastVectorMath::ray_sphere_intersection(const Vector3 &origin, const Vector3 &dir,
		const Vector3 &sphere_center, float radius) {
	// Solve ||origin + t*dir - sphere_center||^2 = radius^2
	Vector3 oc(
			origin.x - sphere_center.x,
			origin.y - sphere_center.y,
			origin.z - sphere_center.z);

	float a = dir.x * dir.x + dir.y * dir.y + dir.z * dir.z;
	float b = 2.0f * (oc.x * dir.x + oc.y * dir.y + oc.z * dir.z);
	float c = oc.x * oc.x + oc.y * oc.y + oc.z * oc.z - radius * radius;

	float discriminant = b * b - 4.0f * a * c;
	if (discriminant < 0.0f) {
		return -1.0f;
	}

	float sqrt_disc = std::sqrt(discriminant);
	float inv2a = 1.0f / (2.0f * a);

	float t1 = (-b - sqrt_disc) * inv2a;
	float t2 = (-b + sqrt_disc) * inv2a;

	if (t1 > 0.0f) {
		return t1;
	}
	if (t2 > 0.0f) {
		return t2;
	}
	return -1.0f;
}
