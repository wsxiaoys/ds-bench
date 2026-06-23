#include "fast_vector_math.h"

#include <godot_cpp/variant/utility_functions.hpp>

void FastVectorMath::_bind_methods() {
    ClassDB::bind_static_method("FastVectorMath", D_METHOD("dot_product", "a", "b"), &FastVectorMath::dot_product);
    ClassDB::bind_static_method("FastVectorMath", D_METHOD("cross_product", "a", "b"), &FastVectorMath::cross_product);
    ClassDB::bind_static_method("FastVectorMath", D_METHOD("compute_centroid_and_bounds", "points"), &FastVectorMath::compute_centroid_and_bounds);
    ClassDB::bind_static_method("FastVectorMath", D_METHOD("ray_sphere_intersection", "origin", "dir", "sphere_center", "radius"), &FastVectorMath::ray_sphere_intersection);
}

float FastVectorMath::dot_product(const Vector3 &a, const Vector3 &b) {
    return a.dot(b);
}

Vector3 FastVectorMath::cross_product(const Vector3 &a, const Vector3 &b) {
    return a.cross(b);
}

Array FastVectorMath::compute_centroid_and_bounds(const PackedVector3Array &points) {
    Array result;
    if (points.is_empty()) {
        result.push_back(Vector3());
        result.push_back(Vector3());
        result.push_back(Vector3());
        return result;
    }

    Vector3 min_bounds = points[0];
    Vector3 max_bounds = points[0];
    Vector3 sum = Vector3();

    for (int i = 0; i < points.size(); i++) {
        const Vector3 &p = points[i];
        sum += p;
        min_bounds.x = MIN(min_bounds.x, p.x);
        min_bounds.y = MIN(min_bounds.y, p.y);
        min_bounds.z = MIN(min_bounds.z, p.z);
        max_bounds.x = MAX(max_bounds.x, p.x);
        max_bounds.y = MAX(max_bounds.y, p.y);
        max_bounds.z = MAX(max_bounds.z, p.z);
    }

    Vector3 centroid = sum / (float)points.size();
    result.push_back(centroid);
    result.push_back(min_bounds);
    result.push_back(max_bounds);
    return result;
}

float FastVectorMath::ray_sphere_intersection(const Vector3 &origin, const Vector3 &dir, const Vector3 &sphere_center, float radius) {
    Vector3 oc = origin - sphere_center;
    float a = dir.dot(dir);
    float b = 2.0f * oc.dot(dir);
    float c = oc.dot(oc) - radius * radius;
    float discriminant = b * b - 4.0f * a * c;

    if (discriminant < 0.0f) {
        return -1.0f;
    }

    float sqrt_disc = Math::sqrt(discriminant);
    float t1 = (-b - sqrt_disc) / (2.0f * a);
    float t2 = (-b + sqrt_disc) / (2.0f * a);

    if (t1 > 0.0f) {
        return t1;
    }
    if (t2 > 0.0f) {
        return t2;
    }
    return -1.0f;
}