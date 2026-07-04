/**************************************************************************/
/*  fast_vector_math.cpp                                                  */
/**************************************************************************/
/* High-performance vector math helper exposed to GDScript via GDExtension. */

#include "fast_vector_math.h"

#include <godot_cpp/core/class_db.hpp>
#include <godot_cpp/core/math.hpp>

using namespace godot;

FastVectorMath::FastVectorMath() {
}

FastVectorMath::~FastVectorMath() {
}

real_t FastVectorMath::dot_product(const Vector3 &p_a, const Vector3 &p_b) {
	return p_a.x * p_b.x + p_a.y * p_b.y + p_a.z * p_b.z;
}

Vector3 FastVectorMath::cross_product(const Vector3 &p_a, const Vector3 &p_b) {
	return Vector3(
			(p_a.y * p_b.z) - (p_a.z * p_b.y),
			(p_a.z * p_b.x) - (p_a.x * p_b.z),
			(p_a.x * p_b.y) - (p_a.y * p_b.x));
}

Array FastVectorMath::compute_centroid_and_bounds(const PackedVector3Array &p_points) {
	Array result;
	result.resize(3);

	const int64_t count = p_points.size();

	if (count == 0) {
		// Degenerate case: no points. Return zeroed vectors so the caller
		// always gets a well-formed [centroid, min, max] triple.
		const Vector3 zero;
		result[0] = zero;
		result[1] = zero;
		result[2] = zero;
		return result;
	}

	Vector3 sum;
	Vector3 min_bounds = p_points[0];
	Vector3 max_bounds = p_points[0];

	for (int64_t i = 0; i < count; i++) {
		const Vector3 &point = p_points[i];

		sum += point;

		if (point.x < min_bounds.x) {
			min_bounds.x = point.x;
		}
		if (point.y < min_bounds.y) {
			min_bounds.y = point.y;
		}
		if (point.z < min_bounds.z) {
			min_bounds.z = point.z;
		}

		if (point.x > max_bounds.x) {
			max_bounds.x = point.x;
		}
		if (point.y > max_bounds.y) {
			max_bounds.y = point.y;
		}
		if (point.z > max_bounds.z) {
			max_bounds.z = point.z;
		}
	}

	const Vector3 centroid(sum.x / static_cast<real_t>(count),
			sum.y / static_cast<real_t>(count),
			sum.z / static_cast<real_t>(count));

	result[0] = centroid;
	result[1] = min_bounds;
	result[2] = max_bounds;
	return result;
}

real_t FastVectorMath::ray_sphere_intersection(const Vector3 &p_origin, const Vector3 &p_dir, const Vector3 &p_sphere_center, real_t p_radius) {
	// Normalize the direction so the returned parameter is a true world-space
	// distance from the ray origin.
	Vector3 dir = p_dir;
	const real_t len_sq = dir.length_squared();
	if (len_sq == 0.0) {
		// A degenerate ray cannot intersect anything.
		return -1.0;
	}
	dir /= Math::sqrt(len_sq);

	// Vector from sphere center to ray origin.
	const Vector3 m = p_origin - p_sphere_center;

	// Solve |origin + t*dir - center|^2 = radius^2.
	// With m = origin - center this expands to:
	//   t^2 * (dir . dir) + 2 t (m . dir) + (m . m - radius^2) = 0
	// Since dir is normalized, dir . dir == 1, so:
	//   t^2 + 2 b t + c = 0   with b = m . dir, c = m . m - radius^2
	const real_t b = m.dot(dir);
	const real_t c = m.dot(m) - p_radius * p_radius;

	// If the ray starts outside the sphere and points away from it, there is
	// no intersection.
	if (c > 0.0 && b > 0.0) {
		return -1.0;
	}

	const real_t disc = b * b - c;

	// A negative discriminant means the ray misses the sphere.
	if (disc < 0.0) {
		return -1.0;
	}

	const real_t sqrt_disc = Math::sqrt(disc);

	// Nearest root.
	real_t t = -b - sqrt_disc;

	// If the nearest root is negative the ray origin is inside the sphere (or
	// the sphere is behind the origin). Use the far root when it is positive
	// so we still report an exit intersection ahead of the origin.
	if (t < 0.0) {
		t = -b + sqrt_disc;
	}

	if (t < 0.0) {
		return -1.0;
	}

	return t;
}

void FastVectorMath::_bind_methods() {
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("dot_product", "a", "b"), &FastVectorMath::dot_product);
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("cross_product", "a", "b"), &FastVectorMath::cross_product);
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("compute_centroid_and_bounds", "points"), &FastVectorMath::compute_centroid_and_bounds);
	ClassDB::bind_static_method("FastVectorMath", D_METHOD("ray_sphere_intersection", "origin", "dir", "sphere_center", "radius"), &FastVectorMath::ray_sphere_intersection);
}