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

FastVectorMath::FastVectorMath() {}

FastVectorMath::~FastVectorMath() {}

float FastVectorMath::dot_product(const Vector3 &a, const Vector3 &b) {
    return a.dot(b);
}

Vector3 FastVectorMath::cross_product(const Vector3 &a, const Vector3 &b) {
    return a.cross(b);
}

Array FastVectorMath::compute_centroid_and_bounds(const PackedVector3Array &points) {
    Array result;
    result.resize(3);
    
    if (points.is_empty()) {
        result[0] = Vector3();
        result[1] = Vector3();
        result[2] = Vector3();
        return result;
    }

    Vector3 centroid;
    Vector3 min_b = points[0];
    Vector3 max_b = points[0];

    int size = points.size();
    for (int i = 0; i < size; ++i) {
        Vector3 p = points[i];
        centroid += p;
        
        if (p.x < min_b.x) min_b.x = p.x;
        if (p.y < min_b.y) min_b.y = p.y;
        if (p.z < min_b.z) min_b.z = p.z;
        
        if (p.x > max_b.x) max_b.x = p.x;
        if (p.y > max_b.y) max_b.y = p.y;
        if (p.z > max_b.z) max_b.z = p.z;
    }

    centroid /= static_cast<float>(size);

    result[0] = centroid;
    result[1] = min_b;
    result[2] = max_b;

    return result;
}

float FastVectorMath::ray_sphere_intersection(const Vector3 &origin, const Vector3 &dir, const Vector3 &sphere_center, float radius) {
    Vector3 oc = origin - sphere_center;
    float a = dir.dot(dir);
    if (a == 0.0f) return -1.0f;
    float b = 2.0f * oc.dot(dir);
    float c = oc.dot(oc) - radius * radius;
    float discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
        return -1.0f;
    }

    float sqrt_d = std::sqrt(discriminant);
    float t1 = (-b - sqrt_d) / (2.0f * a);
    float t2 = (-b + sqrt_d) / (2.0f * a);

    if (t1 > 0) return t1;
    if (t2 > 0) return t2;

    return -1.0f;
}
