# 2D Ragdoll with PinJoint2D

Build a 2D ragdoll in the Godot 4 project at `/home/user/ragdoll` using `RigidBody2D` parts connected by `PinJoint2D` constraints.

## Requirements

### Files & Structure
Your implementation must be contained in the following files relative to the project root:
- `scenes/Ragdoll.tscn`
- `scripts/Ragdoll.gd`

The Godot project must load cleanly without any parse or script errors.

### Scene Structure (`scenes/Ragdoll.tscn`)
- **Root Node**: The root node must be a `Node2D` with the script `scripts/Ragdoll.gd` attached.
- **RigidBody2D Parts**: The ragdoll must have exactly six `RigidBody2D` children with the following exact names:
  - `Head`
  - `Torso`
  - `LeftArm`
  - `RightArm`
  - `LeftLeg`
  - `RightLeg`
  Each of these body parts must have a reasonable `mass`, a `CollisionShape2D` child with a valid shape resource, and a visual placeholder child (either `ColorRect` or `Polygon2D`).
- **PinJoint2D Constraints**: The ragdoll must have exactly five `PinJoint2D` nodes. Use their `node_a` and `node_b` properties (as `NodePath` values) to connect the parts. The connections must form the following unordered body-name pairs:
  - `(Head, Torso)`
  - `(LeftArm, Torso)`
  - `(RightArm, Torso)`
  - `(LeftLeg, Torso)`
  - `(RightLeg, Torso)`
  Both endpoints for each pin joint must resolve to existing `RigidBody2D` child nodes.

### Script API & Behavior (`scripts/Ragdoll.gd`)
The script attached to the root of the ragdoll must implement the following:
- **Class Name**: Declare `class_name Ragdoll`.
- **Signal**: Declare `signal ragdoll_collapsed(avg_pos: Vector2)`.
- **Methods**:
  - `apply_impulse_to(part_name: StringName, impulse: Vector2) -> void`
    Finds the named body part and calls `apply_central_impulse(impulse)` on it.
  - `freeze_all(freeze: bool) -> void`
    Sets the `freeze` property on all six body parts to the provided boolean value.
  - `get_part(name: StringName) -> RigidBody2D`
    Returns the `RigidBody2D` child matching the given name.
  - `get_average_position() -> Vector2`
    Returns the centroid (average `global_position`) of the six body parts.
- **Collapse Detection**:
  - Check the resting state of the ragdoll every physics frame.
  - Emit the `ragdoll_collapsed` signal **exactly once** with the current `get_average_position()` value when the ragdoll has settled.
  - The ragdoll is considered settled/collapsed when, on every physics frame for the last 0.5 seconds, no body part's `global_position` has moved more than 0.5 pixels from its position in the previous physics frame.
