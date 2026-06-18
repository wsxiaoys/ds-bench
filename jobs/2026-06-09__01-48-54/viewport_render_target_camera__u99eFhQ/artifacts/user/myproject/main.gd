extends Node

func set_camera_pose(pos: Vector3, basis: Basis) -> void:
	var cam = $World/SourceViewport/SourceCamera
	cam.global_position = pos
	cam.global_basis = basis
