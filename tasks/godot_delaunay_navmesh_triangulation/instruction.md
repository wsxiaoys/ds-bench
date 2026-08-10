# 2D Navigation Mesh Generator (Godot 4.3, GDScript)

## Background
You are building the geometry core of a 2D navigation system for a Godot 4.3 game. Given a walkable region described by an outer boundary polygon with one or more holes cut out of it, you must triangulate the *walkable* area, expose the resulting triangle mesh and its connectivity, and answer spatial queries (point location and triangle-level pathfinding) over it. The engine ships the `Geometry2D` singleton (polygon triangulation and point/polygon predicates) and the `AStar2D` class (graph search); the solution must be built on top of them and run under `godot --headless` with no display, no network, and no external assets.

## Requirements
Implement a GDScript navigation-mesh class and the query operations described below:
- Triangulate the region equal to the interior of the outer boundary polygon minus the interior of every hole polygon, using `Geometry2D` triangulation. The boundary may be concave; there may be several holes.
- Compute triangle-to-triangle adjacency based on shared edges.
- Build a graph whose nodes are triangle centroids and whose arcs connect adjacent triangles, using `AStar2D`, and use it to answer triangle-level path queries.
- Provide point location (which triangle contains a world point) that correctly reports points inside holes and outside the boundary as not walkable.

## Implementation Hints
- Project path: `/home/user/project` (an existing Godot 4.3 project containing `project.godot`). The evaluator invokes the engine as `godot --headless --path /home/user/project`.
- Deliver a script at `res://navmesh.gd` (i.e. `/home/user/project/navmesh.gd`) that can be instantiated with `load("res://navmesh.gd").new()`. It must expose exactly the following public methods; all coordinates are plain world-space `Vector2` values (no node transforms are applied):
  - `build(boundary: PackedVector2Array, holes: Array) -> void`
    Rebuilds the navigation mesh. `boundary` is a simple, non-self-intersecting polygon that may be concave. `holes` is an `Array` whose elements are each a `PackedVector2Array` describing a simple polygon that lies strictly inside `boundary`; holes do not touch or overlap each other or the boundary. Boundary and hole polygons may be supplied in either clockwise or counter-clockwise vertex order, and the implementation must exclude every hole interior regardless of the winding it was given. Each call to `build` fully replaces the state used by all query methods.
  - `get_triangles() -> Array`
    Returns an `Array` in which element `t` is a `PackedVector2Array` of exactly three vertices (world coordinates) of triangle `t`. Triangle indices are the positions `0 .. n-1` in this array and are the indices used by every other method. The union of the returned triangles must cover exactly the walkable region (boundary interior minus all hole interiors); no triangle may cover any part of a hole interior or any area outside the boundary, and no triangle may be degenerate (zero area).
  - `get_adjacency() -> Array`
    Returns an `Array` of length `n` (the triangle count) in which element `t` is an `Array` of the indices of the triangles adjacent to triangle `t`, sorted in ascending order. Two distinct triangles are adjacent if and only if they share a common edge, meaning they have two vertices at the same position (compared with a small tolerance). Adjacency is symmetric and no triangle is adjacent to itself.
  - `triangle_at_point(point: Vector2) -> int`
    Returns the index of a triangle that contains `point`, or `-1` when `point` lies outside the walkable region (outside the boundary, or inside any hole).
  - `find_triangle_path(from_point: Vector2, to_point: Vector2) -> PackedInt32Array`
    Returns a sequence of triangle indices forming a path from the triangle containing `from_point` to the triangle containing `to_point`, computed with a centroid-based `AStar2D` search over the triangle adjacency graph. The first element must equal `triangle_at_point(from_point)` and the last element must equal `triangle_at_point(to_point)`. Every pair of consecutive indices in the result must be adjacent triangles. If either endpoint is outside the walkable region, or the endpoints lie in disconnected components, return an empty `PackedInt32Array`. If both endpoints resolve to the same triangle, return that single index.
- The implementation must be pure computation with no reliance on the network, external files, or a display server; it must load and run under `godot --headless`.

