/* FastVectorMath - GDExtension class providing static vector math helpers. */

#include "fast_vector_math.h"

#include <godot_cpp/core/class_db.hpp>
#include <godot_cpp/variant/utility_functions.hpp>

using namespace godot;

FastVectorMath::FastVectorMath() {
}

FastVectorMath::~FastVectorMath() {
}

double FastVectorMath::dot_product(const Vector3 &a, const Vector3 &b) {
	return a.dot(b);
}

Vector3 FastVectorMath::cross_product(const Vector3 &a, const Vector3 &b) {
	return a.cross(b);
}

Array FastVectorMath::compute_centroid_and_bounds(const PackedVector3Array &points) {
	Array result;
	int size = points.size();
	if (size == 0) {
		result.push_back(Vector3(0, 0, 0));
		result.push_back(Vector3(0, 0, 0));
		result.push_back(Vector3(0, 0, 0));
		return result;
	}

	Vector3 sum(0, 0, 0);
	Vector3 min_bounds = points[0];
	Vector3 max_bounds = points[0];

	for (int i = 0; i < size; i++) {
		const Vector3 &p = points[i];
		sum += p;
		if (p.x < min_bounds.x) {
			min_bounds.x = p.x;
		}
		if (p.y < min_bounds.y) {
			min_bounds.y = p.y;
		}
		if (p.z < min_bounds.z) {
			min_bounds.z = p.z;
		}
		if (p.x > max_bounds.x) {
			max_bounds.x = p.x;
		}
		if (p.y > max_bounds.y) {
			max_bounds.y = p.y;
		}
		if (p.z > max_bounds.z) {
			max_bounds.z = p.z;
		}
	}

	Vector3 centroid = sum / static_cast<double>(size);
	result.push_back(centroid);
	result.push_back(min_bounds);
	result.push_back(max_bounds);
	return result;
}

double FastVectorMath::ray_sphere_intersection(const Vector3 &origin, const Vector3 &dir, const Vector3 &sphere_center, double radius) {
	// Returns the nearest positive hit distance, or -1.0 on miss.
	Vector3 oc = origin - sphere_center;
	double a = dir.dot(dir);
	if (a <= 0.0) {
		return -1.0;
	}
	double b = oc.dot(dir);
	double c = oc.dot(oc) - radius * radius;
	double discriminant = b * b - a * c;
	if (discriminant < 0.0) {
		return -1.0;
	}
	double sq = Math::sqrt(discriminant);
	double t1 = (-b - sq) / a;
	double t2 = (-b + sq) / a;
	if (t1 > 0.0) {
		return t1;
	}
	if (t2 > 0.0) {
		return t2;
	}
	return -1.0;
}

void FastVectorMath::_bind_methods() {
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("dot_product", "a", "b"), &FastVectorMath::dot_product);
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("cross_product", "a", "b"), &FastVectorMath::cross_product);
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("compute_centroid_and_bounds", "points"), &FastVectorMath::compute_centroid_and_bounds);
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("ray_sphere_intersection", "origin", "dir", "sphere_center", "radius"), &FastVectorMath::ray_sphere_intersection);
}
