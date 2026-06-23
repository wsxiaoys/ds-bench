extends Node3D

## Root script for the security-camera demo scene.
## Exposes set_camera_pose() so external test runners can reposition the
## SourceCamera and observe the rendered result via the SubViewport texture.

@onready var _source_camera: Camera3D = $World/SourceViewport/SourceCamera


## Reposition the source camera so the SubViewport renders from the new pose
## on the very next frame.
##
## pos   – world-space position for the camera.
## basis – world-space orientation for the camera (columns are right/up/-fwd).
func set_camera_pose(pos: Vector3, basis: Basis) -> void:
	_source_camera.global_transform = Transform3D(basis, pos)
