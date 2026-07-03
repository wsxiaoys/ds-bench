extends Node
class_name PlayerAnimController

@onready var anim_tree: AnimationTree = $"../AnimationTree"

func set_move_input(input_vec: Vector2) -> void:
	if anim_tree:
		anim_tree.set("parameters/Locomotion/blend_position", input_vec)

func trigger_attack() -> void:
	if anim_tree:
		anim_tree.set("parameters/conditions/condition_attack", true)

func current_state() -> StringName:
	if anim_tree:
		var playback = anim_tree.get("parameters/playback")
		if playback:
			return playback.get_current_node()
	return StringName("")

func _process(_delta: float) -> void:
	if anim_tree:
		var playback = anim_tree.get("parameters/playback")
		if playback and playback.get_current_node() == &"Attack":
			anim_tree.set("parameters/conditions/condition_attack", false)
