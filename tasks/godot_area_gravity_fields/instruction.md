# Overlapping Gravity Fields with Space-Override Priority Resolution

## Background

In Godot 4, several `Area2D` nodes can overlap and each can override gravity for
bodies inside it. Each area has a gravity **space-override mode**, a **priority**,
and either a **directional** or a **point** gravity definition. When a point is
covered by multiple areas, the engine resolves a single net gravity vector by
processing the overlapping areas in priority order and combining/replacing their
contributions according to each area's override mode, optionally folding in the
project's default gravity.

You must build a Godot 4 project that (a) reproduces this resolution logic for an
arbitrary world position and (b) contains a real `RigidBody2D` that falls through
the configured fields with the correct resulting trajectory.

## Requirements

- Build a scene containing six overlapping `Area2D` gravity fields (exactly as
  specified below) plus one `RigidBody2D` probe.
- Implement a controller that, given any world-space position, returns the net
  gravity vector that Godot's `Area2D` space-override rules (together with the
  project's default gravity) produce at that position.
- The `RigidBody2D` probe must respond to these fields so that, starting from a
  known rest state and advancing Godot's fixed-step physics, it reaches the
  expected position and velocity at the specified checkpoints.

## Implementation Hints

- Project path: `/home/user/gravity_fields` (an empty, valid Godot 4 project is
  already present). `godot --headless --path /home/user/gravity_fields --quit`
  must exit 0 with no script/scene parse errors.
- The project is already configured with these physics settings (do not change
  them): physics runs at exactly **60 ticks per second**; default gravity
  magnitude is **100** with default gravity direction **(0, 1)**; default linear
  and angular damping are **0**.
- Create exactly these files (relative to the project root):
  - `scripts/FieldController.gd`
  - `scripts/ProbeBody.gd`
  - `scenes/GravityLab.tscn`
- `scenes/GravityLab.tscn`:
  - Root node is a `Node2D` named `GravityLab` with `scripts/FieldController.gd`
    attached.
  - Contains exactly six `Area2D` children with the exact names, global
    positions, rectangle sizes, and gravity settings in the table below. Each
    `Area2D` has one `CollisionShape2D` child whose `RectangleShape2D` has the
    listed `size`, placed at local position `(0, 0)` with no rotation and unit
    scale, so the field's axis-aligned rectangle is centered on the `Area2D`'s
    global position. All areas have identity rotation and unit scale.
  - Contains one `RigidBody2D` child named `Probe` at global position `(0, 0)`
    with an initial linear velocity of `(0, 0)` and one `CollisionShape2D` child
    with a real shape resource.

  Gravity field configuration (all magnitudes are px/s²; directions are unit
  vectors; `override` uses Godot's `Area2D.SpaceOverride` names):

  | name | global_position | rect size | priority | override | gravity type | gravity | direction / point |
  |------|-----------------|-----------|----------|----------|--------------|---------|-------------------|
  | `FieldGlobalDown` | `(0, 500)`    | `(4000, 4000)` | 10 | `SPACE_OVERRIDE_COMBINE`         | directional | 200 | direction `(0, 1)` |
  | `FieldPushRight`  | `(0, 300)`    | `(3000, 2000)` | 30 | `SPACE_OVERRIDE_REPLACE_COMBINE` | directional | 300 | direction `(1, 0)` |
  | `FieldExtraDown`  | `(0, 300)`    | `(3000, 2000)` | 20 | `SPACE_OVERRIDE_COMBINE`         | directional | 100 | direction `(0, 1)` |
  | `FieldWell`       | `(800, -400)` | `(600, 600)`   | 40 | `SPACE_OVERRIDE_REPLACE`         | point       | 400 | point center (local) `(0, 0)`, unit distance `0.0` |
  | `FieldPushLeft`   | `(-900, -400)`| `(600, 600)`   | 50 | `SPACE_OVERRIDE_COMBINE_REPLACE` | directional | 250 | direction `(-1, 0)` |
  | `FieldHighDown`   | `(1600, 300)` | `(600, 800)`   | 35 | `SPACE_OVERRIDE_COMBINE`         | directional | 500 | direction `(0, 1)` |

- `scripts/FieldController.gd`:
  - Declares `class_name FieldController` and `extends Node2D`.
  - Defines `net_gravity_at(world_pos: Vector2) -> Vector2` returning the net
    gravity acceleration (px/s²) that applies at `world_pos`, resolved from the
    six configured fields plus the project default gravity, exactly as Godot's
    `Area2D` gravity space-override system would resolve it. This must be correct
    for **any** world position (a position covered by no field returns the
    default gravity). Point-gravity fields with unit distance `0.0` produce a
    constant-magnitude acceleration directed toward the field's world center.
  - Example results your `net_gravity_at` must produce (values within ±0.5 px/s²):

    | world_pos | net gravity |
    |-----------|-------------|
    | `(0, 0)`       | `(300, 400)` |
    | `(900, -300)`  | `(-282.843, -282.843)` |
    | `(-900, -300)` | `(-250, 0)` |
    | `(1700, 300)`  | `(0, 800)` |
    | `(1400, 300)`  | `(300, 400)` |
    | `(3000, 0)`    | `(0, 100)` |
    | `(0, 2000)`    | `(0, 300)` |

- `scripts/ProbeBody.gd`:
  - Attached to the `Probe` `RigidBody2D`. Drives the probe so that it responds
    to the resolved gravity fields under Godot's fixed-step physics.
- Runtime trajectory (verified headless): starting from `Probe` at rest at
  `(0, 0)` and advancing the physics simulation at 60 ticks/second, the probe's
  global position and linear velocity must match (position within ±25 px per
  axis, velocity within ±15 px/s per axis):
  - after 60 physics ticks: position ≈ `(152.5, 203.333)`, velocity ≈ `(300, 400)`
  - after 120 physics ticks: position ≈ `(605.0, 806.667)`, velocity ≈ `(600, 800)`

