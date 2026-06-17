#include "fast_vector_math.h"
#include <godot_cpp/core/class_db.hpp>
#include <cmath>
#include <algorithm>

using namespace godot;

FastVectorMath::FastVectorMath() {}
FastVectorMath::~FastVectorMath() {}

float FastVectorMath::dot_product(const Vector3 &p_a, const Vector3 &p_b) {
	return p_a.dot(p_b);
}

Vector3 FastVectorMath::cross_product(const Vector3 &p_a, const Vector3 &p_b) {
	return p_a.cross(p_b);
}

Array FastVectorMath::compute_centroid_and_bounds(const PackedVector3Array &p_points) {
	int count = p_points.size();
	Array ret;
	ret.resize(3);
	if (count == 0) {
		ret[0] = Vector3();
		ret[1] = Vector3();
		ret[2] = Vector3();
		return ret;
	}

	Vector3 sum;
	Vector3 min_b = p_points[0];
	Vector3 max_b = p_points[0];

	for (int i = 0; i < count; i++) {
		Vector3 p = p_points[i];
		sum += p;
		min_b.x = std::min(min_b.x, p.x);
		min_b.y = std::min(min_b.y, p.y);
		min_b.z = std::min(min_b.z, p.z);
		max_b.x = std::max(max_b.x, p.x);
		max_b.y = std::max(max_b.y, p.y);
		max_b.z = std::max(max_b.z, p.z);
	}

	Vector3 centroid = sum / count;
	ret[0] = centroid;
	ret[1] = min_b;
	ret[2] = max_b;
	return ret;
}

float FastVectorMath::ray_sphere_intersection(const Vector3 &p_origin, const Vector3 &p_dir, const Vector3 &p_sphere_center, float p_radius) {
	if (p_dir.length_squared() < 1e-8) {
		return -1.0;
	}
	Vector3 d = p_dir.normalized();
	Vector3 oc = p_origin - p_sphere_center;
	float a = d.dot(d); // 1.0 since it's normalized
	float b = 2.0 * oc.dot(d);
	float c = oc.dot(oc) - p_radius * p_radius;
	float discriminant = b * b - 4.0 * a * c;

	if (discriminant < 0.0) {
		return -1.0;
	}

	float sqrt_disc = std::sqrt(discriminant);
	float t1 = (-b - sqrt_disc) / (2.0 * a);
	float t2 = (-b + sqrt_disc) / (2.0 * a);

	if (t1 > 0.0) {
		return t1;
	} else if (t2 > 0.0) {
		return t2;
	} else {
		return -1.0;
	}
}

void FastVectorMath::_bind_methods() {
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("dot_product", "a", "b"), &FastVectorMath::dot_product);
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("cross_product", "a", "b"), &FastVectorMath::cross_product);
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("compute_centroid_and_bounds", "points"), &FastVectorMath::compute_centroid_and_bounds);
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("ray_sphere_intersection", "origin", "dir", "sphere_center", "radius"), &FastVectorMath::ray_sphere_intersection);
}
