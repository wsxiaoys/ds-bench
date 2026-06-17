extends SceneTree

## Build script that creates the Player.tscn scene with:
##  - AnimationPlayer containing idle, walk_north, walk_south, walk_east, walk_west, attack
##  - AnimationTree with BlendSpace2D locomotion + Attack state machine
##  - PlayerAnimController node

const SCENE_PATH := "res://scenes/Player.tscn"
const SCRIPT_PATH := "res://scripts/PlayerAnimController.gd"
const LIB_PATH := "res://scenes/player_anims.res"


func _init() -> void:
	_run()
	quit()


func _run() -> void:
	_create_animation_library()
	var scene: PackedScene = _build_scene()
	var err: Error = ResourceSaver.save(scene, SCENE_PATH)
	if err != OK:
		printerr("Failed to save scene: ", err)
	else:
		print("Scene saved to ", SCENE_PATH)


# ── Animation Library ──────────────────────────────────────────────────────

func _create_animation_library() -> void:
	var lib := AnimationLibrary.new()

	for anim_name in ["idle", "walk_north", "walk_south", "walk_east", "walk_west", "attack"]:
		var anim := Animation.new()
		anim.length = 1.0
		anim.loop_mode = Animation.LOOP_LINEAR

		# Add a track so every animation has >= 1 track.
		var track_idx := anim.add_track(Animation.TYPE_VALUE)
		anim.track_set_path(track_idx, ".:position")
		anim.track_insert_key(track_idx, 0.0, Vector2.ZERO)
		anim.track_insert_key(track_idx, 1.0, Vector2(10.0, 0.0) if anim_name != "idle" else Vector2.ZERO)

		lib.add_animation(anim_name, anim)

	var err: Error = ResourceSaver.save(lib, LIB_PATH)
	if err != OK:
		printerr("Failed to save animation library: ", err)
	else:
		print("Animation library saved to ", LIB_PATH)


# ── Scene construction ─────────────────────────────────────────────────────

func _build_scene() -> PackedScene:
	# Root: Node2D (so position tracks resolve)
	var root := Node2D.new()
	root.name = "Player"

	# ── AnimationPlayer ──
	var anim_player := AnimationPlayer.new()
	anim_player.name = "AnimationPlayer"
	var lib: AnimationLibrary = load(LIB_PATH)
	# Add the library *once* under a single key — all animations live inside it.
	anim_player.add_animation_library("", lib)
	root.add_child(anim_player)
	anim_player.set_owner(root)

	# ── AnimationTree ──
	var tree := AnimationTree.new()
	tree.name = "AnimationTree"
	# Set anim_player to the NodePath of the AnimationPlayer relative to the AnimationTree's parent.
	# Since both are children of root: "../AnimationPlayer"
	tree.anim_player = NodePath("../AnimationPlayer")
	tree.active = false  # harness will set it true

	# Build the state machine
	var sm := AnimationNodeStateMachine.new()

	# -- Locomotion: BlendSpace2D --
	var bs := AnimationNodeBlendSpace2D.new()
	# BlendSpace2D has no 'name' property that we can set to String; we rely on SM node name.

	# Blend points: idle at (0,0) + 4 cardinal walks
	_add_blend_point(bs, "idle", Vector2(0, 0))
	_add_blend_point(bs, "walk_north", Vector2(0, -1))
	_add_blend_point(bs, "walk_south", Vector2(0, 1))
	_add_blend_point(bs, "walk_east", Vector2(1, 0))
	_add_blend_point(bs, "walk_west", Vector2(-1, 0))

	sm.add_node("Locomotion", bs, Vector2(200, 200))

	# -- Attack: AnimationNodeAnimation --
	var attack_node := AnimationNodeAnimation.new()
	attack_node.animation = &"attack"
	sm.add_node("Attack", attack_node, Vector2(600, 200))

	# -- Transitions --
	# Locomotion -> Attack: advances on condition_attack
	var t1 := AnimationNodeStateMachineTransition.new()
	t1.advance_mode = AnimationNodeStateMachineTransition.ADVANCE_MODE_ENABLED
	t1.advance_condition = "condition_attack"
	sm.add_transition("Locomotion", "Attack", t1)

	# Attack -> Locomotion: switch mode AtEnd
	var t2 := AnimationNodeStateMachineTransition.new()
	t2.switch_mode = AnimationNodeStateMachineTransition.SWITCH_MODE_AT_END
	sm.add_transition("Attack", "Locomotion", t2)

	tree.tree_root = sm
	root.add_child(tree)
	tree.set_owner(root)

	# ── PlayerAnimController ──
	var controller := Node.new()
	controller.name = "PlayerAnimController"
	var script: GDScript = load(SCRIPT_PATH)
	controller.set_script(script)
	root.add_child(controller)
	controller.set_owner(root)

	# ── Pack ──
	var scene := PackedScene.new()
	var err: Error = scene.pack(root)
	if err != OK:
		printerr("Failed to pack scene: ", err)
	return scene


func _add_blend_point(bs: AnimationNodeBlendSpace2D, anim_name: String, pos: Vector2) -> void:
	var node := AnimationNodeAnimation.new()
	node.animation = anim_name
	bs.add_blend_point(node, pos)
