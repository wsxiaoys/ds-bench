extends Node3D

# Public API: Set the source camera's global transform.
# This determines what the SubViewport renders for the security-camera monitor.
#
# Parameters:
#   pos   - world-space position of the source camera.
#   basis - world-space basis (rotation) of the source camera.
func set_camera_pose(pos: Vector3, basis: Basis) -> void:
	var source_camera: Camera3D = $World/SourceViewport/SourceCamera
	if source_camera == null:
		push_error("set_camera_pose: SourceCamera node not found at World/SourceViewport/SourceCamera")
		return
	var t := Transform3D(basis, pos)
	source_camera.global_transform = t
	# Make sure this camera stays the active camera of the SubViewport so the
	# texture reflects its view on the next rendered frame.
	source_camera.current = true
