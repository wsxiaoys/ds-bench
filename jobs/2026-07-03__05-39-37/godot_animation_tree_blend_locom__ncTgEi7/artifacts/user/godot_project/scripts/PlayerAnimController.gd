extends Node
## Controller for the Player scene's AnimationTree locomotion and attack state machine.
##
## Provides a small API to drive the AnimationTree blend-space locomotion and
## trigger the attack transition from the state machine.

@onready var _anim_tree: AnimationTree = get_node("../AnimationTree")


## Sets the blend position of the Locomotion BlendSpace2D.
func set_move_input(input_vec: Vector2) -> void:
	_anim_tree.set("parameters/Locomotion/blend_position", input_vec)


## Initiates the Locomotion -> Attack transition by enabling the
## ``condition_attack`` state-machine condition.
func trigger_attack() -> void:
	_anim_tree.set("parameters/condition_attack", true)


## Returns the name of the currently active state-machine node.
func current_state() -> StringName:
	var playback: AnimationNodeStateMachinePlayback = _anim_tree.get("parameters/playback")
	return playback.get_current_node()