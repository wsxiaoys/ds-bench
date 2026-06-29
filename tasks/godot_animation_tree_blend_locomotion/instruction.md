# animation_tree_blend_locomotion

Build a Godot 4 locomotion AnimationTree in `/home/user/godot_project`.

## Task Description
In this task, you will set up a player scene and control script in Godot 4 to manage character locomotion and attacking animations using an `AnimationTree` state machine.

### Scene Setup
- Create an instantiable player scene at `res://scenes/Player.tscn`.
- The root of the scene must contain children named `AnimationPlayer`, `AnimationTree`, and `PlayerAnimController`.
- Attach a script at `res://scripts/PlayerAnimController.gd` to the `PlayerAnimController` node.

### Animation and State Machine Structure
- The `AnimationPlayer` must expose the following animations (each containing at least one track): `idle`, `walk_north`, `walk_south`, `walk_east`, `walk_west`, and `attack`.
- The `AnimationTree.tree_root` must be configured as an `AnimationNodeStateMachine` containing the following state nodes:
  - `Locomotion`: An `AnimationNodeBlendSpace2D` with at least 5 blend points (representing idle at `(0,0)` and the 4 cardinal walks).
  - `Attack`: An `AnimationNodeAnimation` whose animation is set to `&"attack"`.
- Configure the transitions between these states as follows:
  - `Locomotion -> Attack`: Advances on the state-machine condition `condition_attack`.
  - `Attack -> Locomotion`: Uses the switch mode `AtEnd`.
- Point `AnimationTree.anim_player` to the `AnimationPlayer`. Note that the `AnimationTree` will be activated programmatically by the evaluation harness.

### PlayerAnimController API
Implement the following methods in the `PlayerAnimController` script:
- `set_move_input(input_vec: Vector2)`: Sets the blend position `parameters/Locomotion/blend_position` to `input_vec`.
- `trigger_attack()`: Initiates the attack transition.
- `current_state() -> StringName`: Returns the current active node name from the state-machine playback.

### Requirements
- The project must run successfully under `godot --headless`.
