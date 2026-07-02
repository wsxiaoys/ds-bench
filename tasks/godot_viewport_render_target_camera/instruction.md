# Render-to-Texture Security Camera (Godot 4)

## Background
Build a render-to-texture security camera system in Godot 4. A separate `SubViewport` containing its own `Camera3D` renders a small 3D world; a HUD `TextureRect` displays that `SubViewport`'s `ViewportTexture` in real time, like a CCTV monitor. Repositioning the source camera at runtime must change what the monitor shows on the next rendered frame.

## Requirements
Deliver a Godot 4 project located at `/home/user/myproject` containing a valid `project.godot` for Godot 4 that the verifier can load headlessly. The project must declare a main scene in the project settings (`application/run/main_scene`). This main scene must contain all required nodes wired together, and a script (attached to the scene root) exposing the public API listed below.

Required node paths (relative to the main scene root):
- `World/SourceViewport` — a `SubViewport`.
- `World/SourceViewport/SourceCamera` — a `Camera3D` that is the current camera for the SubViewport.
- `World/SourceViewport/SceneRoot` — a `Node3D` that holds the three colored target meshes.
- `World/SourceViewport/SceneRoot/RedCube` — `MeshInstance3D`.
- `World/SourceViewport/SceneRoot/GreenCube` — `MeshInstance3D`.
- `World/SourceViewport/SceneRoot/BlueCube` — `MeshInstance3D`.
- `HUD/MonitorScreen` — a `TextureRect` whose `texture` is the `ViewportTexture` of `World/SourceViewport`.

Required public method on the main scene root script:
- `set_camera_pose(pos: Vector3, basis: Basis) -> void` — sets the global transform of `World/SourceViewport/SourceCamera` so that the next rendered frame uses this pose.

The three colored cubes must be visible as solid colors regardless of lighting:
- `RedCube` at world position `(3, 0, 0)` shown as pure red `Color(1, 0, 0)`.
- `GreenCube` at world position `(-3, 0, 0)` shown as pure green `Color(0, 1, 0)`.
- `BlueCube` at world position `(0, 0, -3)` shown as pure blue `Color(0, 0, 1)`.
The SubViewport background (visible behind/around the cubes) must be black `Color(0, 0, 0)`.

SubViewport behavior:
- `size` must be `Vector2i(256, 256)`.
- `render_target_update_mode` must be `SubViewport.UPDATE_ALWAYS` so the texture refreshes every frame.
- `transparent_bg` must be off (false), so the background contributes the chosen clear color.

## Implementation Hints
- The render-to-texture pipeline in Godot 4 uses `SubViewport` + `ViewportTexture`. A `TextureRect` can display a `ViewportTexture` whose `viewport_path` points to the `SubViewport`.
- To get deterministic pixel colors regardless of lighting, use unshaded materials on the target meshes (for example via `StandardMaterial3D` with `shading_mode = SHADING_MODE_UNSHADED`, or by using a flat material that ignores lights).
- A solid background color for the SubViewport can be enforced via a `WorldEnvironment` placed inside the SubViewport with `Environment.background_mode = BG_COLOR` and `background_color = Color.BLACK`.
- The source camera must be the SubViewport's current camera so that `ViewportTexture.get_image()` reflects the rendered scene. Use `Camera3D.current = true` or `Camera3D.make_current()`.
- After moving the camera, the texture only reflects the new view on the *next* rendered frame; the verifier handles awaiting `RenderingServer.frame_post_draw`.
- The verifier will test your camera implementation by positioning it to look at each cube and checking the center pixel `(128, 128)` of the `SubViewport` (with a channel tolerance ≤ 0.15):
  - Looking at `RedCube`: After calling `set_camera_pose(Vector3(3, 0, 5), Basis.IDENTITY)`, the center pixel must be red-dominant (red channel ≥ 0.8, green ≤ 0.2, blue ≤ 0.2).
  - Looking at `GreenCube`: After calling `set_camera_pose(Vector3(-3, 0, 5), Basis.IDENTITY)`, the center pixel must be green-dominant (green ≥ 0.8, red ≤ 0.2, blue ≤ 0.2).
  - Looking at `BlueCube`: After calling `set_camera_pose(Vector3(0, 0, -8), Basis.from_euler(Vector3(0, PI, 0)))`, the center pixel must be blue-dominant (blue ≥ 0.8, red ≤ 0.2, green ≤ 0.2).
  - Background Check: A pixel sampled in an empty corner of the SubViewport (e.g., `(8, 8)`) must read as black (all channels ≤ 0.1) for at least one of the camera poses, proving the SubViewport background is black.

