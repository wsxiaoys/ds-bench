extends Node


func _ready() -> void:
	# Create shared box mesh
	var box_mesh := BoxMesh.new()
	box_mesh.size = Vector3(2, 2, 2)

	# Create unshaded materials for each cube
	var red_mat := StandardMaterial3D.new()
	red_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	red_mat.albedo_color = Color(1, 0, 0)

	var green_mat := StandardMaterial3D.new()
	green_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	green_mat.albedo_color = Color(0, 1, 0)

	var blue_mat := StandardMaterial3D.new()
	blue_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	blue_mat.albedo_color = Color(0, 0, 1)

	# Assign meshes and materials to cubes
	var red_cube: MeshInstance3D = $World/SourceViewport/SceneRoot/RedCube
	red_cube.mesh = box_mesh
	red_cube.set_surface_override_material(0, red_mat)

	var green_cube: MeshInstance3D = $World/SourceViewport/SceneRoot/GreenCube
	green_cube.mesh = box_mesh
	green_cube.set_surface_override_material(0, green_mat)

	var blue_cube: MeshInstance3D = $World/SourceViewport/SceneRoot/BlueCube
	blue_cube.mesh = box_mesh
	blue_cube.set_surface_override_material(0, blue_mat)

	# Create WorldEnvironment for black background inside SubViewport
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color.BLACK
	var world_env := WorldEnvironment.new()
	world_env.environment = env
	$World/SourceViewport/SceneRoot.add_child(world_env)

	# Set up ViewportTexture on MonitorScreen
	$HUD/MonitorScreen.texture = $World/SourceViewport.get_texture()


func set_camera_pose(pos: Vector3, basis: Basis) -> void:
	$World/SourceViewport/SourceCamera.global_transform = Transform3D(basis, pos)
