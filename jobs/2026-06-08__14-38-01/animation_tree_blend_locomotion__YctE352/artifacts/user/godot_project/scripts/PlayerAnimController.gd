extends Node
class_name PlayerAnimController

@onready var anim_tree: AnimationTree = get_parent().get_node("AnimationTree")

var playback: AnimationNodeStateMachinePlayback:
	get:
		if anim_tree:
			return anim_tree.get("parameters/playback")
		return null

func set_move_input(input_vec: Vector2) -> void:
	if anim_tree:
		anim_tree.set("parameters/Locomotion/blend_position", input_vec)

func trigger_attack() -> void:
	if anim_tree:
		anim_tree.set("parameters/conditions/condition_attack", true)

func current_state() -> StringName:
	var pb = playback
	if pb:
		return pb.get_current_node()
	return &""

func _process(_delta: float) -> void:
	if anim_tree and anim_tree.get("parameters/conditions/condition_attack"):
		if current_state() == &"Attack":
			anim_tree.set("parameters/conditions/condition_attack", false)
