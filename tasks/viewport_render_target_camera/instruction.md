# Render-to-Texture Security Camera (Godot 4)

## Background
Build a render-to-texture security camera system in Godot 4. A separate `SubViewport` containing its own `Camera3D` renders a small 3D world; a HUD `TextureRect` displays that `SubViewport`'s `ViewportTexture` in real time, like a CCTV monitor. Repositioning the source camera at runtime must change what the monitor shows on the next rendered frame.

## Requirements
Deliver a Godot 4 project that the verifier can load headlessly. The project must contain a main scene that contains all required nodes wired together, and a script (attached to the scene root) exposing the public API listed below.

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

## Acceptance Criteria
- Project path: `/home/user/myproject` containing a valid `project.godot` for Godot 4.
- The project must declare a main scene whose root contains the node paths listed in Requirements and provides the `set_camera_pose(pos, basis)` public method on its attached script.
- The Godot 4 verifier (a headless invocation of the Godot 4 binary that loads `/home/user/myproject` with an injected `res://test_runner.tscn`) must be able to:
  - Instance the main scene.
  - Call `set_camera_pose(pos, basis)` on the root.
  - Read pixels from the `SubViewport` at `World/SourceViewport` via `get_texture().get_image()` after awaiting `RenderingServer.frame_post_draw`.
- Expected pixel-color behavior at the center pixel `(128, 128)` of the 256×256 SubViewport image, with channel tolerance ≤ 0.15:
  - After `set_camera_pose(Vector3(3, 0, 5), Basis.IDENTITY)` (camera at +Z looking at the red cube), the center pixel must read as red-dominant: red channel ≥ 0.8, green channel ≤ 0.2, blue channel ≤ 0.2.
  - After `set_camera_pose(Vector3(-3, 0, 5), Basis.IDENTITY)` (camera at +Z looking at the green cube), the center pixel must read as green-dominant: green ≥ 0.8, red ≤ 0.2, blue ≤ 0.2.
  - After `set_camera_pose(Vector3(0, 0, -8), Basis.from_euler(Vector3(0, PI, 0)))` (camera placed behind the blue cube and rotated 180° around Y so it looks toward +Z), the center pixel must read as blue-dominant: blue ≥ 0.8, red ≤ 0.2, green ≤ 0.2.
- A pixel sampled in an empty corner of the SubViewport (for example `(8, 8)`) must read as black (all channels ≤ 0.1) for at least one of the three camera poses above, proving the SubViewport background is black.
- The `HUD/MonitorScreen` TextureRect's `texture` property must be a `ViewportTexture` whose `viewport_path` resolves to the `World/SourceViewport` node.

