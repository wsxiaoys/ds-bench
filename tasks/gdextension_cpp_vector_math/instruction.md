# GDExtension C++: FastVectorMath

## Background
Build a Godot 4 GDExtension in C++ that exposes a high-performance vector math helper class to GDScript.

## Requirements
- Implement a C++ class `FastVectorMath` that inherits from `RefCounted` and exposes the following static methods to GDScript via the godot-cpp bindings:
  - `dot_product(a: Vector3, b: Vector3) -> float`
  - `cross_product(a: Vector3, b: Vector3) -> Vector3`
  - `compute_centroid_and_bounds(points: PackedVector3Array) -> Array` returning `[centroid, min_bounds, max_bounds]` as three `Vector3` values.
  - `ray_sphere_intersection(origin: Vector3, dir: Vector3, sphere_center: Vector3, radius: float) -> float` returning the nearest positive hit distance, or `-1.0` on miss.
- Build the shared library into `bin/` and ship a `bin/fast_vector_math.gdextension` configuration file that loads the binary on Linux x86_64.
- A GDScript `test_runner.gd` at the project root must instantiate the class via `ClassDB.instantiate("FastVectorMath")` and print sanity check results.

## Implementation Hints
- Use the official `godot-cpp` submodule already present in the project to obtain the bindings and `SConstruct` scaffolding.
- Register the class and bind static methods inside `_bind_methods()` using `ClassDB::bind_static_method`.
- The `.gdextension` file must declare an `entry_symbol` matching the C-linkage init function in your `register_types.cpp`.
- Use `scons platform=linux target=template_release` (or equivalent) to build the extension; the resulting `.so` file path must match what the `.gdextension` file references.

## Acceptance Criteria
- Project path: /home/user/myproject
- Command: `godot --headless --path /home/user/myproject --script res://test_runner.gd`
- The shared library referenced by `bin/fast_vector_math.gdextension` for `linux.*.x86_64` must exist on disk after the build.
- After Godot loads the extension, `ClassDB.class_exists("FastVectorMath")` must return `true`.
- `FastVectorMath` must expose the four static methods described in Requirements, callable from GDScript.
- `test_runner.gd` must print one PASS line per check (one for each method) and a final `ALL TESTS PASSED` line to stdout when every check succeeds.

