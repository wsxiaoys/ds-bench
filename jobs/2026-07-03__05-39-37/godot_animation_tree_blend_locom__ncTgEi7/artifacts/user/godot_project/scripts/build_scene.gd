@tool
extends SceneTree

## Builder script that programmatically constructs the Player scene and saves
## it to res://scenes/Player.tscn.
##
## Run with:  godot --headless --script res://scripts/build_scene.gd

func _init() -> void:
	_build_and_save()
	quit()


func _build_and_save() -> void:
	# --- Root node (Node2D so we can animate its position property) -----------
	var root := Node2D.new()
	root.name = "Player"

	# --- AnimationPlayer ----------------------------------------------------
	var anim_player := AnimationPlayer.new()
	anim_player.name = "AnimationPlayer"
	root.add_child(anim_player)
	anim_player.owner = root

	var lib := AnimationLibrary.new()
	var anim_names := ["idle", "walk_north", "walk_south", "walk_east", "walk_west", "attack"]
	for anim_name in anim_names:
		var anim := Animation.new()
		anim.resource_name = anim_name
		anim.length = 1.0
		if anim_name != "attack":
			anim.loop_mode = Animation.LOOP_LINEAR
		# Value track on the parent (root) Node2D position – satisfies the
		# "at least one track" requirement.
		var track_idx := anim.add_track(Animation.TYPE_VALUE)
		anim.track_set_path(track_idx, NodePath("../:position"))
		anim.track_insert_key(track_idx, 0.0, Vector2.ZERO)
		anim.value_track_set_update_mode(track_idx, Animation.UPDATE_CONTINUOUS)
		lib.add_animation(anim_name, anim)

	anim_player.add_animation_library("", lib)

	# --- AnimationTree ------------------------------------------------------
	var anim_tree := AnimationTree.new()
	anim_tree.name = "AnimationTree"
	root.add_child(anim_tree)
	anim_tree.owner = root
	anim_tree.anim_player = NodePath("../AnimationPlayer")

	# --- State machine (tree_root) ------------------------------------------
	var sm := AnimationNodeStateMachine.new()

	# Locomotion: BlendSpace2D with 5 blend points
	var bs2d := AnimationNodeBlendSpace2D.new()
	bs2d.sync = true
	bs2d.min_space = Vector2(-1, -1)
	bs2d.max_space = Vector2(1, 1)

	_add_blend_point(bs2d, "idle", Vector2(0, 0))
	_add_blend_point(bs2d, "walk_north", Vector2(0, -1))
	_add_blend_point(bs2d, "walk_south", Vector2(0, 1))
	_add_blend_point(bs2d, "walk_east", Vector2(1, 0))
	_add_blend_point(bs2d, "walk_west", Vector2(-1, 0))

	sm.add_node("Locomotion", bs2d)

	# Attack: AnimationNodeAnimation
	var attack_node := AnimationNodeAnimation.new()
	attack_node.animation = &"attack"
	sm.add_node("Attack", attack_node)

	# Transition: Locomotion -> Attack  (advances on condition_attack)
	var trans_to_attack := AnimationNodeStateMachineTransition.new()
	trans_to_attack.advance_condition = "condition_attack"
	trans_to_attack.switch_mode = AnimationNodeStateMachineTransition.SWITCH_MODE_IMMEDIATE
	sm.add_transition("Locomotion", "Attack", trans_to_attack)

	# Transition: Attack -> Locomotion  (switch mode AtEnd)
	var trans_to_locomotion := AnimationNodeStateMachineTransition.new()
	trans_to_locomotion.switch_mode = AnimationNodeStateMachineTransition.SWITCH_MODE_AT_END
	sm.add_transition("Attack", "Locomotion", trans_to_locomotion)

	# "Locomotion" is the first node added, so it is the default start node.

	anim_tree.tree_root = sm

	# --- PlayerAnimController ------------------------------------------------
	var controller := Node.new()
	controller.name = "PlayerAnimController"
	controller.script = load("res://scripts/PlayerAnimController.gd")
	root.add_child(controller)
	controller.owner = root

	# --- Pack and save ------------------------------------------------------
	var packed := PackedScene.new()
	var err := packed.pack(root)
	if err != OK:
		push_error("Failed to pack scene: %d" % err)
		return

	err = ResourceSaver.save(packed, "res://scenes/Player.tscn")
	if err != OK:
		push_error("Failed to save scene: %d" % err)
		return

	print("Player scene saved to res://scenes/Player.tscn")


func _add_blend_point(bs2d: AnimationNodeBlendSpace2D, anim_name: String, pos: Vector2) -> void:
	var node := AnimationNodeAnimation.new()
	node.animation = StringName(anim_name)
	bs2d.add_blend_point(node, pos)