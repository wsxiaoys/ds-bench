## test_anim_tree.gd
## Headless smoke-test for the Player scene and AnimationTree setup.
## Run with:
##   godot --headless --script tests/test_anim_tree.gd
extends SceneTree

func _init() -> void:
	_run_tests()
	quit(0)

func _run_tests() -> void:
	var ok := true

	# ── Load the scene ────────────────────────────────────────────────────────
	var scene_res: PackedScene = load("res://scenes/Player.tscn")
	if scene_res == null:
		_fail("Could not load res://scenes/Player.tscn")
		return
	var player: Node = scene_res.instantiate()
	get_root().add_child(player)

	# ── Check required child nodes ────────────────────────────────────────────
	var anim_player := player.get_node_or_null("AnimationPlayer") as AnimationPlayer
	var anim_tree   := player.get_node_or_null("AnimationTree")   as AnimationTree
	var controller  := player.get_node_or_null("PlayerAnimController")

	ok = _assert(anim_player != null, "AnimationPlayer child exists") and ok
	ok = _assert(anim_tree   != null, "AnimationTree child exists")   and ok
	ok = _assert(controller  != null, "PlayerAnimController child exists") and ok
	if not ok:
		return

	# ── AnimationPlayer animations ────────────────────────────────────────────
	for anim_name in [&"idle", &"walk_north", &"walk_south", &"walk_east", &"walk_west", &"attack"]:
		var anim := anim_player.get_animation(anim_name)
		ok = _assert(anim != null, "AnimationPlayer has animation: %s" % anim_name) and ok
		if anim != null:
			ok = _assert(anim.get_track_count() >= 1,
					"  %s track_count >= 1 (got %d)" % [anim_name, anim.get_track_count()]) and ok

	# ── AnimationTree root is a StateMachine ──────────────────────────────────
	var sm := anim_tree.tree_root as AnimationNodeStateMachine
	ok = _assert(sm != null, "tree_root is AnimationNodeStateMachine") and ok
	if sm == null:
		return

	# ── State nodes ───────────────────────────────────────────────────────────
	var loco_node := sm.get_node(&"Locomotion")
	var bs2d      := loco_node as AnimationNodeBlendSpace2D
	ok = _assert(bs2d != null, "Locomotion state is AnimationNodeBlendSpace2D") and ok
	if bs2d != null:
		ok = _assert(bs2d.get_blend_point_count() >= 5,
				"  BlendSpace2D has >= 5 points (got %d)" % bs2d.get_blend_point_count()) and ok
		var idle_idx := -1
		for i in bs2d.get_blend_point_count():
			if bs2d.get_blend_point_position(i).is_equal_approx(Vector2.ZERO):
				idle_idx = i
				break
		ok = _assert(idle_idx >= 0, "  idle point is at (0,0)") and ok

	var attack_node := sm.get_node(&"Attack") as AnimationNodeAnimation
	ok = _assert(attack_node != null, "Attack state is AnimationNodeAnimation") and ok
	if attack_node != null:
		ok = _assert(attack_node.animation == &"attack",
				"  Attack.animation == &\"attack\" (got \"%s\")" % attack_node.animation) and ok

	# ── Transitions ───────────────────────────────────────────────────────────
	var trans_count := sm.get_transition_count()
	var found_loco_to_attack  := false
	var found_attack_to_loco  := false
	for i in trans_count:
		var t_from := sm.get_transition_from(i)
		var t_to   := sm.get_transition_to(i)
		var t      := sm.get_transition(i)
		if t_from == &"Locomotion" and t_to == &"Attack":
			found_loco_to_attack = true
			ok = _assert(t.advance_condition == &"condition_attack",
					"  Locomotion->Attack advance_condition == condition_attack") and ok
			ok = _assert(t.advance_mode == AnimationNodeStateMachineTransition.ADVANCE_MODE_ENABLED,
					"  Locomotion->Attack advance_mode == ENABLED") and ok
		if t_from == &"Attack" and t_to == &"Locomotion":
			found_attack_to_loco = true
			ok = _assert(t.switch_mode == AnimationNodeStateMachineTransition.SWITCH_MODE_AT_END,
					"  Attack->Locomotion switch_mode == AT_END") and ok
	ok = _assert(found_loco_to_attack, "Transition Locomotion->Attack exists") and ok
	ok = _assert(found_attack_to_loco, "Transition Attack->Locomotion exists") and ok

	# ── anim_player NodePath ──────────────────────────────────────────────────
	ok = _assert(anim_tree.anim_player == NodePath("../AnimationPlayer"),
			"AnimationTree.anim_player points to ../AnimationPlayer") and ok

	# ── Activate the tree then test the controller API ────────────────────────
	anim_tree.active = true
	ok = _assert(anim_tree.active, "AnimationTree.active is true after harness sets it") and ok

	# Kick the playback into the declared start_node ("Locomotion") and
	# advance a tick so the SM is fully settled there.
	var playback := anim_tree.get("parameters/playback") as AnimationNodeStateMachinePlayback
	playback.start(&"Locomotion", true)
	anim_tree.advance(0.001)

	# set_move_input readback
	controller.set_move_input(Vector2(1, 0))
	var bp: Vector2 = anim_tree.get("parameters/Locomotion/blend_position")
	ok = _assert(bp.distance_to(Vector2(1, 0)) < 0.01,
			"set_move_input(1,0) reads back within 0.01 (got %s)" % bp) and ok

	# current_state in Locomotion
	ok = _assert(controller.current_state() == &"Locomotion",
			"initial current_state == &\"Locomotion\"") and ok

	# trigger_attack -> state should become Attack within 2 frames.
	# trigger_attack() calls _playback.travel(&"Attack") which is synchronous;
	# we then advance the AnimationTree by a small delta to let the SM step.
	controller.trigger_attack()
	anim_tree.advance(0.001)
	var state_after_trigger: StringName = controller.current_state()
	ok = _assert(state_after_trigger == &"Attack",
			"after trigger_attack current_state == &\"Attack\" (got \"%s\")" % state_after_trigger) and ok

	# ── Summary ───────────────────────────────────────────────────────────────
	if ok:
		print("ALL TESTS PASSED")
	else:
		print("SOME TESTS FAILED")
		quit(1)

func _assert(condition: bool, message: String) -> bool:
	if condition:
		print("  PASS: %s" % message)
	else:
		print("  FAIL: %s" % message)
	return condition

func _fail(message: String) -> void:
	print("  FATAL: %s" % message)
	quit(1)
