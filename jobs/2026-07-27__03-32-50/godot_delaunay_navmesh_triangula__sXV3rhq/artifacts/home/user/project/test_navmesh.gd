extends SceneTree

func poly_area(p: PackedVector2Array) -> float:
	var a = 0.0
	var n = p.size()
	for i in range(n):
		var j = (i+1)%n
		a += p[i].x*p[j].y - p[j].x*p[i].y
	return absf(a)/2.0

func tris_area(tris: Array) -> float:
	var total = 0.0
	for t in tris:
		total += poly_area(t)
	return total

func _init():
	# ---- Test 1: square with one hole ----
	var nav = load("res://navmesh.gd").new()
	var boundary = PackedVector2Array([Vector2(0,0), Vector2(10,0), Vector2(10,10), Vector2(0,10)])
	var hole = PackedVector2Array([Vector2(3,3), Vector2(6,3), Vector2(6,6), Vector2(3,6)])
	nav.build(boundary, [hole])
	var tris = nav.get_triangles()
	print("T1 tri count:", tris.size(), " area:", tris_area(tris), " expect 91")
	print("T1 point in hole (4,4):", nav.triangle_at_point(Vector2(4,4)), " expect -1")
	print("T1 point outside (20,20):", nav.triangle_at_point(Vector2(20,20)), " expect -1")
	print("T1 point walkable (1,1):", nav.triangle_at_point(Vector2(1,1)))
	print("T1 point walkable (9,9):", nav.triangle_at_point(Vector2(9,9)))
	var adj = nav.get_adjacency()
	var sym_ok = true
	for i in range(adj.size()):
		for j in adj[i]:
			if not (i in adj[j]):
				sym_ok = false
	print("T1 adjacency symmetric:", sym_ok, " n=", adj.size())
	var path = nav.find_triangle_path(Vector2(1,1), Vector2(9,9))
	print("T1 path:", path)
	# validate path adjacency & endpoints
	var valid_path = path.size() > 0
	if valid_path:
		if path[0] != nav.triangle_at_point(Vector2(1,1)) or path[path.size()-1] != nav.triangle_at_point(Vector2(9,9)):
			valid_path = false
		for k in range(path.size()-1):
			if not (path[k+1] in adj[path[k]]):
				valid_path = false
	print("T1 path valid:", valid_path)

	# path that must go around the hole: from left side to right side through corridor near bottom
	var path2 = nav.find_triangle_path(Vector2(1,5), Vector2(9,5))
	print("T1 path2 (around hole):", path2, " len:", path2.size())

	# ---- Test 2: concave boundary (L-shape) with a hole ----
	var nav2 = load("res://navmesh.gd").new()
	var lshape = PackedVector2Array([
		Vector2(0,0), Vector2(10,0), Vector2(10,4), Vector2(4,4), Vector2(4,10), Vector2(0,10)
	])
	var hole2 = PackedVector2Array([Vector2(1,1), Vector2(2,1), Vector2(2,2), Vector2(1,2)])
	nav2.build(lshape, [hole2])
	var tris2 = nav2.get_triangles()
	print("T2 tri count:", tris2.size(), " area:", tris_area(tris2), " expect ", poly_area(lshape)-poly_area(hole2))
	print("T2 point in notch (7,7) should be outside (-1):", nav2.triangle_at_point(Vector2(7,7)))
	print("T2 point in hole (1.5,1.5):", nav2.triangle_at_point(Vector2(1.5,1.5)), " expect -1")
	print("T2 point walkable (0.5,0.5):", nav2.triangle_at_point(Vector2(0.5,0.5)))

	# ---- Test 3: two holes ----
	var nav3 = load("res://navmesh.gd").new()
	var b3 = PackedVector2Array([Vector2(0,0), Vector2(20,0), Vector2(20,20), Vector2(0,20)])
	var h1 = PackedVector2Array([Vector2(2,2), Vector2(5,2), Vector2(5,5), Vector2(2,5)])
	var h2 = PackedVector2Array([Vector2(10,10), Vector2(15,10), Vector2(15,15), Vector2(10,15)])
	nav3.build(b3, [h1, h2])
	var tris3 = nav3.get_triangles()
	print("T3 tri count:", tris3.size(), " area:", tris_area(tris3), " expect ", poly_area(b3)-poly_area(h1)-poly_area(h2))
	print("T3 in hole1 (3,3):", nav3.triangle_at_point(Vector2(3,3)), " expect -1")
	print("T3 in hole2 (12,12):", nav3.triangle_at_point(Vector2(12,12)), " expect -1")
	var p3 = nav3.find_triangle_path(Vector2(1,1), Vector2(19,19))
	print("T3 path len:", p3.size(), p3)
	var adj3 = nav3.get_adjacency()
	var sym_ok3 = true
	for i in range(adj3.size()):
		for j in adj3[i]:
			if not (i in adj3[j]):
				sym_ok3 = false
			if j == i:
				sym_ok3 = false
	print("T3 adjacency symmetric & no self:", sym_ok3)

	# ---- Test 4: holes given in reversed (opposite) winding just to check normalization ----
	var nav4 = load("res://navmesh.gd").new()
	var b4 = PackedVector2Array([Vector2(0,10), Vector2(10,10), Vector2(10,0), Vector2(0,0)]) # CW boundary
	var h4 = PackedVector2Array([Vector2(3,3), Vector2(3,6), Vector2(6,6), Vector2(6,3)]) # CCW hole
	nav4.build(b4, [h4])
	var tris4 = nav4.get_triangles()
	print("T4 tri count:", tris4.size(), " area:", tris_area(tris4), " expect 91")

	# ---- Test 5: same triangle shortcut ----
	var same = nav.find_triangle_path(Vector2(1,1), Vector2(1.01,1.01))
	print("T_same path:", same)

	quit()
