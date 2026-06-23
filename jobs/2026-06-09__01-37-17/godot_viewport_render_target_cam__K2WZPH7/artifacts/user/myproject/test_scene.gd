extends Node

func _ready() -> void:
	print("Test scene ready!")
	# Load main scene
	var main_scene = load("res://main.tscn")
	if not main_scene:
		print("FAIL: Could not load main.tscn")
		get_tree().quit(1)
		return
	
	var inst = main_scene.instantiate()
	if not inst:
		print("FAIL: Could not instantiate main.tscn")
		get_tree().quit(1)
		return
	
	add_child(inst)
	
	# Verify node paths
	var source_viewport = inst.get_node_or_null("World/SourceViewport")
	if not source_viewport:
		print("FAIL: World/SourceViewport not found")
		get_tree().quit(1)
		return
		
	var source_camera = inst.get_node_or_null("World/SourceViewport/SourceCamera")
	if not source_camera:
		print("FAIL: World/SourceViewport/SourceCamera not found")
		get_tree().quit(1)
		return
		
	var scene_root = inst.get_node_or_null("World/SourceViewport/SceneRoot")
	if not scene_root:
		print("FAIL: World/SourceViewport/SceneRoot not found")
		get_tree().quit(1)
		return
		
	var red_cube = inst.get_node_or_null("World/SourceViewport/SceneRoot/RedCube")
	if not red_cube:
		print("FAIL: RedCube not found")
		get_tree().quit(1)
		return
		
	var green_cube = inst.get_node_or_null("World/SourceViewport/SceneRoot/GreenCube")
	if not green_cube:
		print("FAIL: GreenCube not found")
		get_tree().quit(1)
		return
		
	var blue_cube = inst.get_node_or_null("World/SourceViewport/SceneRoot/BlueCube")
	if not blue_cube:
		print("FAIL: BlueCube not found")
		get_tree().quit(1)
		return
		
	var monitor_screen = inst.get_node_or_null("HUD/MonitorScreen")
	if not monitor_screen:
		print("FAIL: HUD/MonitorScreen not found")
		get_tree().quit(1)
		return
		
	# Verify texture is ViewportTexture and points to World/SourceViewport
	var tex = monitor_screen.texture
	if not tex:
		print("FAIL: HUD/MonitorScreen texture is null")
		get_tree().quit(1)
		return
	if not tex is ViewportTexture:
		print("FAIL: HUD/MonitorScreen texture is not a ViewportTexture")
		get_tree().quit(1)
		return
	if tex.viewport_path != NodePath("World/SourceViewport"):
		print("FAIL: HUD/MonitorScreen texture viewport_path is: ", tex.viewport_path)
		get_tree().quit(1)
		return
		
	print("PASS: Node hierarchy and texture path verified.")
	
	# Wait for a couple of frames to let the engine initialize and render once
	await get_tree().process_frame
	await get_tree().process_frame
	
	# Test 1: Red cube
	print("Testing Red Cube pose...")
	inst.set_camera_pose(Vector3(3, 0, 5), Basis.IDENTITY)
	await RenderingServer.frame_post_draw
	var img = source_viewport.get_texture().get_image()
	if not img:
		print("FAIL: Could not get image from viewport")
		get_tree().quit(1)
		return
	var center_pixel = img.get_pixel(128, 128)
	print("Red Cube Center Pixel: ", center_pixel)
	if center_pixel.r < 0.8 or center_pixel.g > 0.2 or center_pixel.b > 0.2:
		print("FAIL: Red Cube pixel check failed")
		get_tree().quit(1)
		return
	var corner_pixel_red = img.get_pixel(8, 8)
	print("Red Cube Corner Pixel (8,8): ", corner_pixel_red)
	
	# Test 2: Green cube
	print("Testing Green Cube pose...")
	inst.set_camera_pose(Vector3(-3, 0, 5), Basis.IDENTITY)
	await RenderingServer.frame_post_draw
	img = source_viewport.get_texture().get_image()
	center_pixel = img.get_pixel(128, 128)
	print("Green Cube Center Pixel: ", center_pixel)
	if center_pixel.g < 0.8 or center_pixel.r > 0.2 or center_pixel.b > 0.2:
		print("FAIL: Green Cube pixel check failed")
		get_tree().quit(1)
		return
	var corner_pixel_green = img.get_pixel(8, 8)
	print("Green Cube Corner Pixel (8,8): ", corner_pixel_green)
		
	# Test 3: Blue cube
	print("Testing Blue Cube pose...")
	inst.set_camera_pose(Vector3(0, 0, -8), Basis.from_euler(Vector3(0, PI, 0)))
	await RenderingServer.frame_post_draw
	img = source_viewport.get_texture().get_image()
	center_pixel = img.get_pixel(128, 128)
	print("Blue Cube Center Pixel: ", center_pixel)
	if center_pixel.b < 0.8 or center_pixel.r > 0.2 or center_pixel.g > 0.2:
		print("FAIL: Blue Cube pixel check failed")
		get_tree().quit(1)
		return
	var corner_pixel_blue = img.get_pixel(8, 8)
	print("Blue Cube Corner Pixel (8,8): ", corner_pixel_blue)
	
	# Check if at least one corner pixel is black (<= 0.1)
	if corner_pixel_red.r > 0.1 or corner_pixel_red.g > 0.1 or corner_pixel_red.b > 0.1:
		if corner_pixel_green.r > 0.1 or corner_pixel_green.g > 0.1 or corner_pixel_green.b > 0.1:
			if corner_pixel_blue.r > 0.1 or corner_pixel_blue.g > 0.1 or corner_pixel_blue.b > 0.1:
				print("FAIL: No corner pixel was black")
				get_tree().quit(1)
				return
				
	print("ALL TESTS PASSED SUCCESSFULLY!")
	get_tree().quit(0)
