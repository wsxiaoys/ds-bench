extends Node


## Sets the global transform of the SourceCamera inside the SubViewport.
## The new pose takes effect on the next rendered frame.
func set_camera_pose(pos: Vector3, basis: Basis) -> void:
	var camera: Camera3D = $World/SourceViewport/SourceCamera
	camera.global_transform = Transform3D(basis, pos)
