class_name InstanceField
extends RefCounted

var multimesh: MultiMesh

func build() -> MultiMesh:
	multimesh = MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.use_colors = true
	multimesh.use_custom_data = true
	multimesh.instance_count = 120
	
	var buf = PackedFloat32Array()
	buf.resize(120 * 20)
	
	for i in range(120):
		var gx = i % 6
		var gy = (i / 6) % 5
		var gz = i / 30
		
		# Origin: Vector3(-5.0 + 2.0 * gx, 0.5 * gy, -3.0 + 1.5 * gz)
		var origin = Vector3(-5.0 + 2.0 * gx, 0.5 * gy, -3.0 + 1.5 * gz)
		
		# Basis: rotation of a = deg_to_rad(30.0 * (gy % 3)) about +Y axis, uniformly scaled by s = 0.5 + 0.1 * ((gx + gz) % 4)
		var a = deg_to_rad(30.0 * (gy % 3))
		var s = 0.5 + 0.1 * ((gx + gz) % 4)
		var basis = Basis().rotated(Vector3.UP, a).scaled(Vector3(s, s, s))
		
		var transform = Transform3D(basis, origin)
		
		# Color: Color(gx / 5.0, gy / 4.0, gz / 3.0, 1.0)
		var color = Color(float(gx) / 5.0, float(gy) / 4.0, float(gz) / 3.0, 1.0)
		
		# Custom Data: Color(i / 1000.0, float(gx + gy + gz), 1.0 + 0.5 * (i % 7), float((gx + gz) % 2))
		var custom_data = Color(float(i) / 1000.0, float(gx + gy + gz), 1.0 + 0.5 * float(i % 7), float((gx + gz) % 2))
		
		# Pack into buffer
		var idx = i * 20
		
		# Row 0
		buf[idx + 0] = transform.basis.x.x
		buf[idx + 1] = transform.basis.y.x
		buf[idx + 2] = transform.basis.z.x
		buf[idx + 3] = transform.origin.x
		
		# Row 1
		buf[idx + 4] = transform.basis.x.y
		buf[idx + 5] = transform.basis.y.y
		buf[idx + 6] = transform.basis.z.y
		buf[idx + 7] = transform.origin.y
		
		# Row 2
		buf[idx + 8] = transform.basis.x.z
		buf[idx + 9] = transform.basis.y.z
		buf[idx + 10] = transform.basis.z.z
		buf[idx + 11] = transform.origin.z
		
		# Color (RGBA)
		buf[idx + 12] = color.r
		buf[idx + 13] = color.g
		buf[idx + 14] = color.b
		buf[idx + 15] = color.a
		
		# Custom Data (RGBA)
		buf[idx + 16] = custom_data.r
		buf[idx + 17] = custom_data.g
		buf[idx + 18] = custom_data.b
		buf[idx + 19] = custom_data.a
		
		# Set individual properties as well (for maximum compatibility in non-headless)
		multimesh.set_instance_transform(i, transform)
		multimesh.set_instance_color(i, color)
		multimesh.set_instance_custom_data(i, custom_data)
		
	multimesh.buffer = buf
	return multimesh

func cull(box_min: Vector3, box_max: Vector3) -> Dictionary:
	var indices = []
	var weight_sum = 0.0
	var flagged_count = 0
	
	if multimesh == null or multimesh.buffer.size() == 0:
		return {
			"indices": indices,
			"count": 0,
			"weight_sum": weight_sum,
			"flagged_count": flagged_count
		}
		
	var buf = multimesh.buffer
	var stride = 20
	var total_instances = multimesh.instance_count
	
	for i in range(total_instances):
		var idx = i * stride
		if idx + 19 >= buf.size():
			break
			
		# Extract origin: Row 0 origin.x, Row 1 origin.y, Row 2 origin.z
		var origin = Vector3(buf[idx + 3], buf[idx + 7], buf[idx + 11])
		
		if (origin.x >= box_min.x and origin.x <= box_max.x and
			origin.y >= box_min.y and origin.y <= box_max.y and
			origin.z >= box_min.z and origin.z <= box_max.z):
			
			indices.append(i)
			
			var custom_b = buf[idx + 18]
			var custom_a = buf[idx + 19]
			
			weight_sum += custom_b
			if custom_a >= 0.5:
				flagged_count += 1
				
	return {
		"indices": indices,
		"count": indices.size(),
		"weight_sum": weight_sum,
		"flagged_count": flagged_count
	}
