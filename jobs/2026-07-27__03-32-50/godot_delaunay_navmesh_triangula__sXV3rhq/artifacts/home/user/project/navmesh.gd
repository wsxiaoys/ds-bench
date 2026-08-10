extends RefCounted
## 2D Navigation Mesh generator.
##
## Triangulates a walkable region (an outer boundary polygon minus zero or
## more interior hole polygons), builds triangle-triangle adjacency and an
## AStar2D graph over triangle centroids, and answers point-location and
## triangle-path queries.

var _triangles: Array = []      # Array[PackedVector2Array], 3 verts each.
var _adjacency: Array = []      # Array[Array[int]], sorted ascending.
var _astar: AStar2D = AStar2D.new()

# Geometric tolerance, derived from the boundary size in build().
var _eps_len: float = 1e-6


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

func build(boundary: PackedVector2Array, holes: Array) -> void:
	_triangles = []
	_adjacency = []
	_astar = AStar2D.new()

	if boundary.size() < 3:
		return

	_eps_len = _compute_epsilon(boundary)

	# Normalize winding: outer boundary CCW, holes CW (opposite of outer).
	var outer: PackedVector2Array = PackedVector2Array(boundary)
	if Geometry2D.is_polygon_clockwise(outer):
		outer.reverse()

	var hole_list: Array = []
	for h in holes:
		var hh: PackedVector2Array = PackedVector2Array(h)
		if hh.size() < 3:
			continue
		if not Geometry2D.is_polygon_clockwise(hh):
			hh.reverse()
		hole_list.append(hh)

	# Merge every hole into a single simple polygon via the classic
	# "bridge"/keyhole technique so that a plain ear-clipping triangulator
	# (Geometry2D.triangulate_polygon) can handle concave boundaries with
	# holes.
	var combined: PackedVector2Array = outer
	var remaining: Array = hole_list.duplicate()
	while remaining.size() > 0:
		var hole: PackedVector2Array = remaining[0]
		var other_holes: Array = remaining.slice(1, remaining.size())
		var bridge: Dictionary = _find_bridge(combined, hole, other_holes)
		combined = _splice_hole(combined, hole, bridge["v_index"], bridge["m_index"])
		remaining.remove_at(0)

	if combined.size() < 3:
		return

	var indices: PackedInt32Array = Geometry2D.triangulate_polygon(combined)
	var tri_count: int = indices.size() / 3

	# Degenerate-area filter threshold (area*2), scaled to the boundary size.
	var eps_area2: float = _eps_len * _eps_len * 0.01

	for t in range(tri_count):
		var i0: int = indices[t * 3]
		var i1: int = indices[t * 3 + 1]
		var i2: int = indices[t * 3 + 2]
		var a: Vector2 = combined[i0]
		var b: Vector2 = combined[i1]
		var c: Vector2 = combined[i2]
		var area2: float = absf(_cross(a, b, c))
		if area2 > eps_area2:
			_triangles.append(PackedVector2Array([a, b, c]))

	_compute_adjacency()
	_build_astar()


func get_triangles() -> Array:
	return _triangles.duplicate(true)


func get_adjacency() -> Array:
	return _adjacency.duplicate(true)


func triangle_at_point(point: Vector2) -> int:
	for t in range(_triangles.size()):
		var tri: PackedVector2Array = _triangles[t]
		if _point_in_triangle(point, tri[0], tri[1], tri[2]):
			return t
	return -1


func find_triangle_path(from_point: Vector2, to_point: Vector2) -> PackedInt32Array:
	var from_t: int = triangle_at_point(from_point)
	var to_t: int = triangle_at_point(to_point)
	if from_t == -1 or to_t == -1:
		return PackedInt32Array()
	if from_t == to_t:
		var single := PackedInt32Array()
		single.append(from_t)
		return single
	if not _astar.has_point(from_t) or not _astar.has_point(to_t):
		return PackedInt32Array()
	var id_path: PackedInt64Array = _astar.get_id_path(from_t, to_t)
	var result := PackedInt32Array()
	for id in id_path:
		result.append(id)
	return result


# ---------------------------------------------------------------------------
# Triangulation / hole bridging internals
# ---------------------------------------------------------------------------

func _compute_epsilon(boundary: PackedVector2Array) -> float:
	var min_p: Vector2 = boundary[0]
	var max_p: Vector2 = boundary[0]
	for p in boundary:
		min_p.x = minf(min_p.x, p.x)
		min_p.y = minf(min_p.y, p.y)
		max_p.x = maxf(max_p.x, p.x)
		max_p.y = maxf(max_p.y, p.y)
	var diag: float = (max_p - min_p).length()
	return maxf(diag * 1e-6, 1e-9)


func _cross(o: Vector2, a: Vector2, b: Vector2) -> float:
	return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)


func _on_segment(p: Vector2, q: Vector2, r: Vector2) -> bool:
	var e: float = _eps_len
	return (minf(p.x, r.x) - e <= q.x and q.x <= maxf(p.x, r.x) + e
		and minf(p.y, r.y) - e <= q.y and q.y <= maxf(p.y, r.y) + e)


func _segments_intersect(p1: Vector2, p2: Vector2, p3: Vector2, p4: Vector2) -> bool:
	var d1: float = _cross(p3, p4, p1)
	var d2: float = _cross(p3, p4, p2)
	var d3: float = _cross(p1, p2, p3)
	var d4: float = _cross(p1, p2, p4)
	var e: float = _eps_len * _eps_len

	if (((d1 > e and d2 < -e) or (d1 < -e and d2 > e))
		and ((d3 > e and d4 < -e) or (d3 < -e and d4 > e))):
		return true

	if absf(d1) <= e and _on_segment(p3, p1, p4):
		return true
	if absf(d2) <= e and _on_segment(p3, p2, p4):
		return true
	if absf(d3) <= e and _on_segment(p1, p3, p2):
		return true
	if absf(d4) <= e and _on_segment(p1, p4, p2):
		return true
	return false


## Checks whether the straight bridge segment combined[i]-hole[j] crosses any
## edge of `combined`, `hole` itself, or any polygon in `other_holes` (edges
## sharing an endpoint with the candidate bridge are skipped, since touching
## at a shared vertex is not a crossing).
func _is_valid_bridge(combined: PackedVector2Array, hole: PackedVector2Array, other_holes: Array, i: int, j: int) -> bool:
	var v: Vector2 = combined[i]
	var m: Vector2 = hole[j]

	var n: int = combined.size()
	for k in range(n):
		if k == i or (k + 1) % n == i:
			continue
		var a: Vector2 = combined[k]
		var b: Vector2 = combined[(k + 1) % n]
		if _segments_intersect(v, m, a, b):
			return false

	var hn: int = hole.size()
	for k in range(hn):
		if k == j or (k + 1) % hn == j:
			continue
		var a2: Vector2 = hole[k]
		var b2: Vector2 = hole[(k + 1) % hn]
		if _segments_intersect(v, m, a2, b2):
			return false

	for oh in other_holes:
		var other: PackedVector2Array = oh
		var on: int = other.size()
		for k in range(on):
			var a3: Vector2 = other[k]
			var b3: Vector2 = other[(k + 1) % on]
			if _segments_intersect(v, m, a3, b3):
				return false

	return true


## Finds a valid (non-crossing) bridge between a vertex of `hole` and a
## vertex of `combined`. Returns {"v_index": int, "m_index": int}.
func _find_bridge(combined: PackedVector2Array, hole: PackedVector2Array, other_holes: Array) -> Dictionary:
	var n: int = combined.size()
	var hn: int = hole.size()

	var m_order: Array = range(hn)
	m_order.sort_custom(func(a, b): return hole[a].x > hole[b].x)

	for j in m_order:
		var m: Vector2 = hole[j]
		var v_order: Array = range(n)
		v_order.sort_custom(func(a, b): return m.distance_squared_to(combined[a]) < m.distance_squared_to(combined[b]))
		for i in v_order:
			if _is_valid_bridge(combined, hole, other_holes, i, j):
				return {"v_index": i, "m_index": j}

	# Should not happen for valid input (hole strictly inside the boundary,
	# not touching/overlapping the boundary or other holes). Fall back to a
	# best-effort bridge so build() does not crash.
	return {"v_index": 0, "m_index": 0}


## Splices `hole` into `combined` at the given bridge indices, producing a
## single simple polygon whose interior equals combined-minus-hole.
func _splice_hole(combined: PackedVector2Array, hole: PackedVector2Array, v_index: int, m_index: int) -> PackedVector2Array:
	var result := PackedVector2Array()
	for i in range(v_index + 1):
		result.append(combined[i])

	var hn: int = hole.size()
	for k in range(hn):
		result.append(hole[(m_index + k) % hn])
	result.append(hole[m_index])
	result.append(combined[v_index])

	for i in range(v_index + 1, combined.size()):
		result.append(combined[i])

	return result


# ---------------------------------------------------------------------------
# Adjacency / point queries / AStar
# ---------------------------------------------------------------------------

func _point_in_triangle(p: Vector2, a: Vector2, b: Vector2, c: Vector2) -> bool:
	var e: float = _eps_len * _eps_len
	var d1: float = _cross(a, b, p)
	var d2: float = _cross(b, c, p)
	var d3: float = _cross(c, a, p)

	var has_neg: bool = (d1 < -e) or (d2 < -e) or (d3 < -e)
	var has_pos: bool = (d1 > e) or (d2 > e) or (d3 > e)
	return not (has_neg and has_pos)


func _shares_edge(tri_a: PackedVector2Array, tri_b: PackedVector2Array) -> bool:
	var e2: float = _eps_len * _eps_len
	var matches: int = 0
	for a in tri_a:
		for b in tri_b:
			if a.distance_squared_to(b) < e2:
				matches += 1
				break
	return matches >= 2


func _compute_adjacency() -> void:
	var n: int = _triangles.size()
	_adjacency = []
	for i in range(n):
		_adjacency.append([])

	for i in range(n):
		for j in range(i + 1, n):
			if _shares_edge(_triangles[i], _triangles[j]):
				_adjacency[i].append(j)
				_adjacency[j].append(i)

	for i in range(n):
		var arr: Array = _adjacency[i]
		arr.sort()


func _centroid(tri: PackedVector2Array) -> Vector2:
	return (tri[0] + tri[1] + tri[2]) / 3.0


func _build_astar() -> void:
	_astar = AStar2D.new()
	for t in range(_triangles.size()):
		_astar.add_point(t, _centroid(_triangles[t]))
	for i in range(_adjacency.size()):
		for j in _adjacency[i]:
			if j > i:
				_astar.connect_points(i, j, true)
