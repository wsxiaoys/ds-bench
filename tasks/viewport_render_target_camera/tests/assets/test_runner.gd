extends Node

# Headless verifier for the viewport render-target camera task.
# Loads the project's main scene, exercises set_camera_pose(),
# samples pixels from the SubViewport's ViewportTexture, and
# writes a JSON summary to /tmp/result.json before quitting.

const RESULT_PATH := "/tmp/result.json"

var _results: Dictionary = {
	"passed": false,
	"checks": {},
	"errors": [],
}


func _record(name: String, ok: bool, detail: String = "") -> void:
	_results["checks"][name] = {"ok": ok, "detail": detail}
	if not ok:
		_results["errors"].append("%s: %s" % [name, detail])


func _color_str(c: Color) -> String:
	return "Color(%.3f, %.3f, %.3f, %.3f)" % [c.r, c.g, c.b, c.a]


func _await_two_frames() -> void:
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw


func _sample(viewport: SubViewport, x: int, y: int) -> Color:
	var tex := viewport.get_texture()
	var img := tex.get_image()
	if img == null:
		return Color(-1, -1, -1, -1)
	return img.get_pixel(x, y)


func _ready() -> void:
	# Discover the project's main scene from project settings.
	var main_scene_path: String = ProjectSettings.get_setting("application/run/main_scene", "")
	if main_scene_path == "" or not ResourceLoader.exists(main_scene_path):
		_record("main_scene_declared", false,
			"application/run/main_scene is unset or missing: %s" % main_scene_path)
		_write_and_quit()
		return
	_record("main_scene_declared", true, main_scene_path)

	var packed: PackedScene = load(main_scene_path) as PackedScene
	if packed == null:
		_record("main_scene_loads", false, "Failed to load %s as PackedScene" % main_scene_path)
		_write_and_quit()
		return
	_record("main_scene_loads", true, main_scene_path)

	var scene_root: Node = packed.instantiate()
	if scene_root == null:
		_record("main_scene_instantiates", false, "PackedScene.instantiate() returned null")
		_write_and_quit()
		return
	add_child(scene_root)
	_record("main_scene_instantiates", true, scene_root.get_class())

	# Allow scene to fully enter the tree before probing.
	await _await_two_frames()

	# Required node paths.
	var sub: Node = scene_root.get_node_or_null("World/SourceViewport")
	if sub == null or not (sub is SubViewport):
		_record("source_viewport_present", false,
			"World/SourceViewport not found or not a SubViewport")
		_write_and_quit()
		return
	_record("source_viewport_present", true, "SubViewport found")

	var camera: Node = scene_root.get_node_or_null("World/SourceViewport/SourceCamera")
	if camera == null or not (camera is Camera3D):
		_record("source_camera_present", false,
			"World/SourceViewport/SourceCamera not found or not a Camera3D")
		_write_and_quit()
		return
	_record("source_camera_present", true, "Camera3D found")

	var hud_rect: Node = scene_root.get_node_or_null("HUD/MonitorScreen")
	if hud_rect == null or not (hud_rect is TextureRect):
		_record("hud_monitor_present", false,
			"HUD/MonitorScreen not found or not a TextureRect")
		_write_and_quit()
		return
	_record("hud_monitor_present", true, "TextureRect found")

	# set_camera_pose method must exist.
	if not scene_root.has_method("set_camera_pose"):
		_record("set_camera_pose_method", false,
			"Root script must define set_camera_pose(pos, basis)")
		_write_and_quit()
		return
	_record("set_camera_pose_method", true, "method exists")

	# SubViewport configuration checks.
	var sv: SubViewport = sub
	_record("subviewport_size_256",
		sv.size == Vector2i(256, 256),
		"size = %s" % str(sv.size))
	_record("subviewport_update_always",
		sv.render_target_update_mode == SubViewport.UPDATE_ALWAYS,
		"render_target_update_mode = %d (expected %d)" % [
			sv.render_target_update_mode, SubViewport.UPDATE_ALWAYS])
	_record("subviewport_opaque_bg",
		not sv.transparent_bg,
		"transparent_bg = %s" % str(sv.transparent_bg))

	# HUD wiring: TextureRect.texture must be a ViewportTexture whose
	# viewport_path resolves to the SubViewport.
	var tr: TextureRect = hud_rect
	var tex: Texture2D = tr.texture
	var hud_ok := false
	var hud_detail := "no texture on HUD/MonitorScreen"
	if tex != null and tex is ViewportTexture:
		var vt: ViewportTexture = tex
		var resolved: Node = tr.get_node_or_null(vt.viewport_path)
		# viewport_path may be resolved relative to the texture's local scene
		# rather than the TextureRect; fall back to scene_root if needed.
		if resolved == null:
			resolved = scene_root.get_node_or_null(vt.viewport_path)
		if resolved == sv:
			hud_ok = true
			hud_detail = "viewport_path resolved to SourceViewport"
		else:
			hud_detail = "ViewportTexture.viewport_path = %s does not resolve to SourceViewport (got %s)" % [
				str(vt.viewport_path),
				str(resolved.get_path()) if resolved != null else "null",
			]
	else:
		if tex == null:
			hud_detail = "TextureRect.texture is null"
		else:
			hud_detail = "TextureRect.texture is %s, not a ViewportTexture" % tex.get_class()
	_record("hud_uses_viewport_texture", hud_ok, hud_detail)

	# Pixel-color checks for three camera poses.
	# (1) Red view.
	scene_root.call("set_camera_pose", Vector3(3, 0, 5), Basis.IDENTITY)
	await _await_two_frames()
	var red_center := _sample(sv, 128, 128)
	_record("red_view_center",
		red_center.r >= 0.8 and red_center.g <= 0.2 and red_center.b <= 0.2,
		"center pixel = %s" % _color_str(red_center))

	# (2) Green view.
	scene_root.call("set_camera_pose", Vector3(-3, 0, 5), Basis.IDENTITY)
	await _await_two_frames()
	var green_center := _sample(sv, 128, 128)
	_record("green_view_center",
		green_center.g >= 0.8 and green_center.r <= 0.2 and green_center.b <= 0.2,
		"center pixel = %s" % _color_str(green_center))

	# (3) Blue view. Position the camera *behind* the blue cube along -Z and
	# rotate 180 degrees around Y so the camera looks toward +Z, exercising
	# both the position and basis arguments of set_camera_pose().
	scene_root.call("set_camera_pose", Vector3(0, 0, -8), Basis.from_euler(Vector3(0, PI, 0)))
	await _await_two_frames()
	var blue_center := _sample(sv, 128, 128)
	_record("blue_view_center",
		blue_center.b >= 0.8 and blue_center.r <= 0.2 and blue_center.g <= 0.2,
		"center pixel = %s" % _color_str(blue_center))

	# Background pixel (corner) should be black after a view with sky visible.
	# Use the blue view (camera close, narrow cube footprint).
	var corner := _sample(sv, 8, 8)
	_record("background_is_black",
		corner.r <= 0.1 and corner.g <= 0.1 and corner.b <= 0.1,
		"corner pixel (8,8) on blue view = %s" % _color_str(corner))

	_write_and_quit()


func _write_and_quit() -> void:
	var all_ok := true
	for k in _results["checks"].keys():
		if not _results["checks"][k]["ok"]:
			all_ok = false
			break
	_results["passed"] = all_ok and _results["errors"].is_empty()

	var f := FileAccess.open(RESULT_PATH, FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify(_results, "  "))
		f.close()
	else:
		push_error("Could not write %s" % RESULT_PATH)
	# Give the engine a moment to flush, then quit.
	await get_tree().process_frame
	get_tree().quit(0 if _results["passed"] else 1)
