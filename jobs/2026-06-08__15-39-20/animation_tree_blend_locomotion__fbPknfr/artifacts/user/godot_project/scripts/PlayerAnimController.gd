extends Node

@onready var anim_tree: AnimationTree = $"../AnimationTree"

func _process(delta):
    if current_state() == &"Attack":
        anim_tree.set("parameters/conditions/condition_attack", false)

func set_move_input(input_vec: Vector2):
    anim_tree.set("parameters/Locomotion/blend_position", input_vec)

func trigger_attack():
    anim_tree.set("parameters/conditions/condition_attack", true)

func current_state() -> StringName:
    var playback = anim_tree.get("parameters/playback")
    if playback:
        return playback.get_current_node()
    return &""
