extends Node3D

# Public API: set the global transform of the source camera
# so the next rendered frame uses this pose.
func set_camera_pose(pos: Vector3, basis: Basis) -> void:
	var cam: Camera3D = $World/SourceViewport/SourceCamera
	if cam == null:
		return
	var t := Transform3D(basis, pos)
	cam.global_transform = t
