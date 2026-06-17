extends Node

@onready var source_camera: Camera3D = $World/SourceViewport/SourceCamera

func _ready() -> void:
	if source_camera:
		source_camera.current = true

func set_camera_pose(pos: Vector3, basis: Basis) -> void:
	if source_camera:
		source_camera.global_transform = Transform3D(basis, pos)
