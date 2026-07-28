extends RefCounted
class_name InstanceField

## Reusable helper that builds a fully-configured, fully-populated MultiMesh
## describing a deterministic 6x5x4 field of 120 instances, and performs a
## CPU-side axis-aligned culling query over that field.
##
## NOTE: Under `godot --headless` there is no GPU-backed RenderingServer, only
## the "dummy" one. In that environment MultiMesh's per-instance getters/
## setters (set_instance_transform, get_instance_transform, etc.) are not
## reliably backed by real storage, but the raw `buffer` PackedFloat32Array
## property round-trips correctly (and is also what gets saved/loaded with
## the resource, and what the automated checks read). For that reason this
## class authors and reads instance data directly through `multimesh.buffer`
## using the documented buffer layout, instead of relying on the per-instance
## getter/setter methods.

const GRID_X := 6
const GRID_Y := 5
const GRID_Z := 4
const INSTANCE_COUNT := GRID_X * GRID_Y * GRID_Z # 120

## The most recently built MultiMesh (set by build()).
var multimesh: MultiMesh


## Maps a linear instance index to its (gx, gy, gz) grid coordinates.
## gx varies fastest, then gy, then gz.
static func _grid_coords(i: int) -> Vector3i:
	var gx := i % GRID_X
	var gy := (i / GRID_X) % GRID_Y
	var gz := i / (GRID_X * GRID_Y)
	return Vector3i(gx, gy, gz)


## Number of floats used per instance in the MultiMesh's raw buffer, given
## its currently configured format flags.
static func _stride_for(mm: MultiMesh) -> int:
	var stride := 12 if mm.transform_format == MultiMesh.TRANSFORM_3D else 8
	if mm.use_colors:
		stride += 4
	if mm.use_custom_data:
		stride += 4
	return stride


func build() -> MultiMesh:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.use_custom_data = true
	mm.instance_count = INSTANCE_COUNT

	var stride := _stride_for(mm)
	var buffer := PackedFloat32Array()
	buffer.resize(stride * INSTANCE_COUNT)

	for i in range(INSTANCE_COUNT):
		var g := _grid_coords(i)
		var gx := g.x
		var gy := g.y
		var gz := g.z

		var origin := Vector3(-5.0 + 2.0 * gx, 0.5 * gy, -3.0 + 1.5 * gz)
		var angle := deg_to_rad(30.0 * float(gy % 3))
		var scale := 0.5 + 0.1 * float((gx + gz) % 4)
		var basis := Basis(Vector3.UP, angle).scaled(Vector3(scale, scale, scale))

		var color := Color(gx / 5.0, gy / 4.0, gz / 3.0, 1.0)
		var custom := Color(
			i / 1000.0,
			float(gx + gy + gz),
			1.0 + 0.5 * float(i % 7),
			float((gx + gz) % 2)
		)

		var base := i * stride
		# Row-major 3x4 transform: each row is (basis_row, origin_component).
		buffer[base + 0] = basis.x.x
		buffer[base + 1] = basis.y.x
		buffer[base + 2] = basis.z.x
		buffer[base + 3] = origin.x
		buffer[base + 4] = basis.x.y
		buffer[base + 5] = basis.y.y
		buffer[base + 6] = basis.z.y
		buffer[base + 7] = origin.y
		buffer[base + 8] = basis.x.z
		buffer[base + 9] = basis.y.z
		buffer[base + 10] = basis.z.z
		buffer[base + 11] = origin.z

		buffer[base + 12] = color.r
		buffer[base + 13] = color.g
		buffer[base + 14] = color.b
		buffer[base + 15] = color.a

		buffer[base + 16] = custom.r
		buffer[base + 17] = custom.g
		buffer[base + 18] = custom.b
		buffer[base + 19] = custom.a

	mm.buffer = buffer

	multimesh = mm
	return mm


## Returns the instances of the most recently built MultiMesh whose transform
## origin lies inside (or on the boundary of) the closed axis-aligned box
## [box_min, box_max], together with aggregates over the visible set.
func cull(box_min: Vector3, box_max: Vector3) -> Dictionary:
	var indices: Array = []
	var weight_sum := 0.0
	var flagged_count := 0

	if multimesh != null:
		var stride := _stride_for(multimesh)
		var buffer := multimesh.buffer
		var count := multimesh.instance_count
		var has_colors := multimesh.use_colors
		var custom_offset := 12
		if has_colors:
			custom_offset += 4

		if buffer.size() >= stride * count:
			for i in range(count):
				var base := i * stride
				var ox: float = buffer[base + 3]
				var oy: float = buffer[base + 7]
				var oz: float = buffer[base + 11]

				if ox >= box_min.x and ox <= box_max.x \
					and oy >= box_min.y and oy <= box_max.y \
					and oz >= box_min.z and oz <= box_max.z:
					indices.append(i)
					if multimesh.use_custom_data:
						var cb: float = buffer[base + custom_offset + 2]
						var ca: float = buffer[base + custom_offset + 3]
						weight_sum += cb
						if ca >= 0.5:
							flagged_count += 1

	indices.sort()

	return {
		"indices": indices,
		"count": indices.size(),
		"weight_sum": weight_sum,
		"flagged_count": flagged_count,
	}
