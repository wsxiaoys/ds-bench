## PlayerAnimController.gd
## Manages the AnimationTree state-machine for the Player.
## Attach this script to the PlayerAnimController node inside Player.tscn.
extends Node

# ── lazy internal references ──────────────────────────────────────────────────

var _tree: AnimationTree:
	get:
		if _tree == null:
			_tree = get_parent().get_node("AnimationTree") as AnimationTree
		return _tree

var _playback: AnimationNodeStateMachinePlayback:
	get:
		if _playback == null and _tree != null:
			_playback = _tree.get("parameters/playback") as AnimationNodeStateMachinePlayback
		return _playback

# ── public API ─────────────────────────────────────────────────────────────────

## Set the 2-D movement vector that drives the Locomotion blend-space.
## e.g. Vector2(1, 0) → full east, Vector2(0, 0) → idle.
func set_move_input(input_vec: Vector2) -> void:
	_tree.set("parameters/Locomotion/blend_position", input_vec)


## Fire the attack transition.  Within 2 process frames current_state()
## will return &"Attack".
## Also sets the condition_attack parameter so the AnimationTree's declared
## condition-based transition is consistent with the playback request.
func trigger_attack() -> void:
	_tree.set("parameters/condition_attack", true)
	_playback.travel(&"Attack")
	# Clear the edge-triggered condition next frame so repeated calls work.
	# Guard against headless/test environments where the node isn't in a tree.
	if is_inside_tree():
		await get_tree().process_frame
	_tree.set("parameters/condition_attack", false)


## Return the name of the active state-machine node.
func current_state() -> StringName:
	return _playback.get_current_node()
