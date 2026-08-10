# navmesh.gd
# 2D Navigation Mesh Generator for Godot 4.3

extends RefCounted

var _triangles: Array = [] # Array of PackedVector2Array
var _adjacency: Array = [] # Array of Array of ints
var _triangle_bboxes: Array = [] # Array of Array [x_min, x_max, y_min, y_max]
var _astar: AStar2D = AStar2D.new()

func build(boundary: PackedVector2Array, holes: Array) -> void:
	# Reset state
	_triangles = []
	_adjacency = []
	_triangle_bboxes = []
	_astar = AStar2D.new()
	
	if boundary.size() < 3:
		return
		
	# Collect all unique X and Y coordinates
	var x_coords = []
	var y_coords = []
	for p in boundary:
		x_coords.append(p.x)
		y_coords.append(p.y)
	for hole_obj in holes:
		var hole = hole_obj as PackedVector2Array
		if hole:
			for p in hole:
				x_coords.append(p.x)
				y_coords.append(p.y)
				
	x_coords.sort()
	y_coords.sort()
	
	# Filter duplicates with a tolerance
	var unique_x = []
	for x in x_coords:
		if unique_x.size() == 0 or abs(x - unique_x[-1]) > 0.0001:
			unique_x.append(x)
	var unique_y = []
	for y in y_coords:
		if unique_y.size() == 0 or abs(y - unique_y[-1]) > 0.0001:
			unique_y.append(y)
			
	if unique_x.size() < 2 or unique_y.size() < 2:
		return
		
	# Precompute bounding boxes for each hole to optimize cell-hole intersection checks
	var hole_bboxes = []
	for hole_obj in holes:
		var hole = hole_obj as PackedVector2Array
		if hole and hole.size() >= 3:
			var hx_min = hole[0].x
			var hx_max = hole[0].x
			var hy_min = hole[0].y
			var hy_max = hole[0].y
			for p in hole:
				hx_min = min(hx_min, p.x)
				hx_max = max(hx_max, p.x)
				hy_min = min(hy_min, p.y)
				hy_max = max(hy_max, p.y)
			hole_bboxes.append([hx_min, hx_max, hy_min, hy_max, hole])
			
	# Generate triangles by slicing space into a grid of rectangular cells
	for i in range(unique_x.size() - 1):
		var x1 = unique_x[i]
		var x2 = unique_x[i+1]
		for j in range(unique_y.size() - 1):
			var y1 = unique_y[j]
			var y2 = unique_y[j+1]
			
			# Define the rectangular cell polygon
			var cell = PackedVector2Array([
				Vector2(x1, y1),
				Vector2(x2, y1),
				Vector2(x2, y2),
				Vector2(x1, y2)
			])
			
			# Filter holes that actually overlap with the cell
			var cell_holes = []
			for h_info in hole_bboxes:
				var h_xmin = h_info[0]
				var h_xmax = h_info[1]
				var h_ymin = h_info[2]
				var h_ymax = h_info[3]
				var hole = h_info[4]
				# Bounding boxes overlap if they intersect (using a small tolerance to be safe)
				if not (h_xmax <= x1 - 0.0001 or h_xmin >= x2 + 0.0001 or h_ymax <= y1 - 0.0001 or h_ymin >= y2 + 0.0001):
					cell_holes.append(hole)
					
			# Intersect boundary with the cell
			var cell_boundary = Geometry2D.intersect_polygons(boundary, cell)
			var cell_walkable = cell_boundary
			
			# Clip each overlapping hole from the walkable cell polygons
			for hole in cell_holes:
				var cell_hole = Geometry2D.intersect_polygons(hole, cell)
				for ch in cell_hole:
					var next_cell_walkable = []
					for cw in cell_walkable:
						var clipped = Geometry2D.clip_polygons(cw, ch)
						next_cell_walkable.append_array(clipped)
					cell_walkable = next_cell_walkable
					
			# Triangulate each walkable polygon in the cell
			for cw in cell_walkable:
				var tris = Geometry2D.triangulate_polygon(cw)
				if tris.size() > 0:
					for t in range(0, tris.size(), 3):
						var p1 = cw[tris[t]]
						var p2 = cw[tris[t+1]]
						var p3 = cw[tris[t+2]]
						
						# Filter out degenerate (zero/near-zero area) triangles
						var area = 0.5 * abs((p2 - p1).cross(p3 - p1))
						if area < 1e-5:
							continue
							
						# Enforce consistent counter-clockwise winding order
						var tri_verts = PackedVector2Array([p1, p2, p3])
						if Geometry2D.is_polygon_clockwise(tri_verts):
							tri_verts = PackedVector2Array([p1, p3, p2])
							
						_triangles.append(tri_verts)
						
	# Compute bounding boxes for fast point location
	for t in _triangles:
		var bx_min = min(t[0].x, min(t[1].x, t[2].x))
		var bx_max = max(t[0].x, max(t[1].x, t[2].x))
		var by_min = min(t[0].y, min(t[1].y, t[2].y))
		var by_max = max(t[0].y, max(t[1].y, t[2].y))
		_triangle_bboxes.append([bx_min, bx_max, by_min, by_max])
		
	# Build adjacency list using spatial hashing of vertices
	var num_triangles = _triangles.size()
	for i in range(num_triangles):
		_adjacency.append([])
		
	var unique_vertices = []
	var triangle_vertex_indices = []
	var spatial_hash = {}
	var cell_size = 10.0 # Grid cell size for spatial hashing
	
	for t in range(num_triangles):
		var indices = []
		for p in _triangles[t]:
			var cx = int(floor(p.x / cell_size))
			var cy = int(floor(p.y / cell_size))
			var found_idx = -1
			
			# Check current cell and 8 adjacent cells
			for dx in [-1, 0, 1]:
				for dy in [-1, 0, 1]:
					var cell = Vector2i(cx + dx, cy + dy)
					if spatial_hash.has(cell):
						for idx in spatial_hash[cell]:
							if p.distance_to(unique_vertices[idx]) < 0.0001:
								found_idx = idx
								break
					if found_idx != -1:
						break
				if found_idx != -1:
					break
					
			if found_idx == -1:
				found_idx = unique_vertices.size()
				unique_vertices.append(p)
				var cell = Vector2i(cx, cy)
				if not spatial_hash.has(cell):
					spatial_hash[cell] = []
				spatial_hash[cell].append(found_idx)
				
			indices.append(found_idx)
		triangle_vertex_indices.append(indices)
		
	# Map edges to triangle indices to find adjacencies in O(T)
	var edge_to_triangles = {}
	for i in range(num_triangles):
		var indices = triangle_vertex_indices[i]
		var edges = [
			Vector2i(min(indices[0], indices[1]), max(indices[0], indices[1])),
			Vector2i(min(indices[1], indices[2]), max(indices[1], indices[2])),
			Vector2i(min(indices[2], indices[0]), max(indices[2], indices[0]))
		]
		for edge in edges:
			if not edge_to_triangles.has(edge):
				edge_to_triangles[edge] = []
			edge_to_triangles[edge].append(i)
			
	for edge in edge_to_triangles:
		var tris = edge_to_triangles[edge]
		if tris.size() > 1:
			for i in range(tris.size()):
				for j in range(i + 1, tris.size()):
					var t1 = tris[i]
					var t2 = tris[j]
					if not t2 in _adjacency[t1]:
						_adjacency[t1].append(t2)
					if not t1 in _adjacency[t2]:
						_adjacency[t2].append(t1)
						
	# Sort adjacency lists
	for i in range(num_triangles):
		_adjacency[i].sort()
		
	# Build AStar2D graph
	for i in range(num_triangles):
		var t = _triangles[i]
		var centroid = (t[0] + t[1] + t[2]) / 3.0
		_astar.add_point(i, centroid)
		
	for i in range(num_triangles):
		for adj_t in _adjacency[i]:
			if i < adj_t:
				_astar.connect_points(i, adj_t)

func get_triangles() -> Array:
	return _triangles

func get_adjacency() -> Array:
	return _adjacency

func triangle_at_point(point: Vector2) -> int:
	for i in range(_triangles.size()):
		var bbox = _triangle_bboxes[i]
		if point.x >= bbox[0] and point.x <= bbox[1] and point.y >= bbox[2] and point.y <= bbox[3]:
			if Geometry2D.is_point_in_polygon(point, _triangles[i]):
				return i
	return -1

func find_triangle_path(from_point: Vector2, to_point: Vector2) -> PackedInt32Array:
	var start_idx = triangle_at_point(from_point)
	var end_idx = triangle_at_point(to_point)
	
	if start_idx == -1 or end_idx == -1:
		return PackedInt32Array()
		
	if start_idx == end_idx:
		var res = PackedInt32Array()
		res.append(start_idx)
		return res
		
	var path = _astar.get_id_path(start_idx, end_idx)
	if path.size() == 0:
		return PackedInt32Array()
		
	var path_32 = PackedInt32Array()
	for id in path:
		path_32.append(id)
	return path_32
