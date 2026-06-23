extends Node

## PlayerAnimController — drives a locomotion blend-space and attack state machine.
## The owning scene must have an AnimationTree sibling whose tree_root is an
## AnimationNodeStateMachine containing a "Locomotion" BlendSpace2D node and an
## "Attack" Animation node, with the transition conditions described below.
##
## * set_move_input(vec: Vector2) — writes parameters/Locomotion/blend_position
## * trigger_attack()           — sets condition_attack so the SM advances
## * current_state() -> StringName — returns the state-machine's current node

@onready var _tree: AnimationTree = get_node("../AnimationTree") as AnimationTree


func set_move_input(input_vec: Vector2) -> void:
	_tree.set("parameters/Locomotion/blend_position", input_vec)


func trigger_attack() -> void:
	# Set the travel condition so the state machine transitions Locomotion → Attack.
	_tree.set("parameters/conditions/condition_attack", true)
	# Advance the state machine so the transition is evaluated immediately.
	_tree.advance(0.0)


func current_state() -> StringName:
	# Navigate: tree_root → AnimationNodeStateMachinePlayback → get_current_node()
	var root: AnimationNode = _tree.tree_root
	var playback: AnimationNodeStateMachinePlayback = _tree.get("parameters/playback") as AnimationNodeStateMachinePlayback
	return playback.get_current_node()
