extends Node

var anim_tree: AnimationTree
var state_machine: AnimationNodeStateMachinePlayback

func _ready() -> void:
	print("Controller _ready called, parent: ", get_parent())
	anim_tree = get_parent().get_node("AnimationTree")
	print("anim_tree: ", anim_tree)
	state_machine = anim_tree.get("parameters/playback")
	print("state_machine: ", state_machine)

func set_move_input(input_vec: Vector2) -> void:
	print("set_move_input called, anim_tree: ", anim_tree)
	if anim_tree:
		anim_tree.set("parameters/Locomotion/blend_position", input_vec)

func trigger_attack() -> void:
	print("trigger_attack called, anim_tree: ", anim_tree)
	if anim_tree:
		anim_tree.set("parameters/conditions/condition_attack", true)

func current_state() -> StringName:
	if state_machine:
		return state_machine.get_current_node()
	return &""
