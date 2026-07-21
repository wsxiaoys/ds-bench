# Layered Area3D Gravity Fields — Deterministic Physics Sampling

## Background
In Godot Engine 4.3, an `Area3D` can override the gravity a `RigidBody3D` feels while the body overlaps it. When several gravity-overriding areas overlap the same body at once, the engine resolves them using each area's gravity **space override mode** and its integer **priority**. You must build a headless Godot 4.3 project that constructs a specific layered-field scene, steps the physics deterministically, and records the body's motion so it can be checked against a reference simulation with a tight tolerance.

## Requirements
- Create a Godot 4.3 project at `/home/user/gravity_sim`.
- The project's main scene contains exactly one dynamic `RigidBody3D` (the "probe") and exactly four gravity-overriding `Area3D` fields, configured precisely as specified below.
- Running the project headless must simulate a fixed number of physics ticks, sample the probe at specified ticks, write the results file, and exit on its own.

## Scene specification (all values exact; positions in meters, gravity magnitudes in m/s²)

World / project:
- Physics tick rate: exactly 60 physics ticks per second (fixed timestep).
- The world default gravity magnitude must be 0, so the only gravity acting on the probe comes from the four fields.

Probe (`RigidBody3D`):
- Starts at global position (0, 0, 0) with initial linear velocity (40, 0, 0).
- mass = 1.0, gravity scale = 1.0, linear damp = 0, angular damp = 0.
- Must never be allowed to sleep during the run.
- On collision layer bit 1, and it must be detectable by all four fields.

Fields — each is an `Area3D` whose gravity override is enabled, with an axis-aligned box collision region centered at the given center with the given full size (X, Y, Z). Every field must detect bodies on collision layer bit 1.

| Field | Box center | Box size (X, Y, Z) | Space override mode | Gravity | priority |
|-------|------------|--------------------|---------------------|---------|----------|
| A | (225, 0, 0) | (600, 2000, 2000) | Combine | directional, direction (1, 0, 0), magnitude 3.0 | 0 |
| B | (30, 0, 0) | (40, 2000, 2000) | Replace-Combine | directional, direction (0, 1, 0), magnitude 9.0 | 10 |
| C | (90, 0, 0) | (60, 2000, 2000) | Combine-Replace | directional, direction (0, 0, 1), magnitude 7.0 | 20 |
| D | (200, 0, 0) | (160, 2000, 2000) | Replace | point gravity toward global point (200, 25, 0), magnitude 15.0, point unit distance 0.0 | 30 |

The four space override modes above correspond to Godot's `Area3D.SPACE_OVERRIDE_COMBINE`, `SPACE_OVERRIDE_REPLACE_COMBINE`, `SPACE_OVERRIDE_COMBINE_REPLACE`, and `SPACE_OVERRIDE_REPLACE` respectively. For field D, "point gravity toward global point (200, 25, 0)" means the attraction center, expressed in world space, is exactly (200, 25, 0).

## Simulation & output
- Simulate exactly 240 physics ticks.
- Maintain an integer tick counter starting at 0; increment it by 1 at the very start of each physics tick. Whenever the counter equals one of the sample ticks 40, 80, 120, 160, 200, or 240, record the probe's current global position and current linear velocity at that moment.
- Immediately after recording tick 240, write the results file and quit the process.
- Write the results as JSON to `/home/user/gravity_sim/output/result.json` with exactly this shape:

```json
{
  "physics_ticks_per_second": 60,
  "samples": [
    { "step": 40, "position": [x, y, z], "velocity": [vx, vy, vz] }
  ]
}
```

`samples` must contain exactly the six sample ticks, in ascending order (40, 80, 120, 160, 200, 240). Each `position` and `velocity` is a 3-element array of numbers ordered X, Y, Z. Emit the numbers with full precision (at least 6 significant digits).

## Implementation Hints
- Project path: /home/user/gravity_sim
- Godot is available on `PATH` as `godot` (Godot 4.3, headless build).
- Evaluation run command: `godot --headless --path /home/user/gravity_sim`. The project's main scene must run automatically under this command and the process must terminate itself after writing the file.
- The engine already resolves overlapping gravity fields from their space override modes and priorities; configure the fields correctly rather than re-implementing gravity resolution yourself.
- The sampled trajectory must be reproducible run-to-run: drive the physics from the fixed timestep and count physics ticks; never sample by wall-clock time.
- Overlap detection requires the probe and the fields to share collision layer/mask bits, and a non-sleeping dynamic body, or fields will silently fail to affect the probe.
