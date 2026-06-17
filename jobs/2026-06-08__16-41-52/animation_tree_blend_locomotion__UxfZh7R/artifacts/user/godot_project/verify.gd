extends SceneTree

## Verification script — checks every criterion listed in the task.

const SCENE_PATH := "res://scenes/Player.tscn"

var _passed := 0
var _failed := 0


func _init() -> void:
	_run()
	quit()


func _run() -> void:
	var scene: PackedScene = load(SCENE_PATH)
	if scene == null:
		_fail("Could not load scene")
		return

	var root: Node = scene.instantiate()
	get_root().add_child(root)

	_check_children(root)
	_check_animation_player(root)
	_check_animation_tree(root)
	_check_controller(root)
	_check_integration(root)

	print("\n────────────────────────────────────────")
	print("RESULTS: %d passed, %d failed" % [_passed, _failed])
	if _failed == 0:
		print("ALL CHECKS PASSED")
	else:
		print("SOME CHECKS FAILED")


# ── Helpers ─────────────────────────────────────────────────────────────────

func _pass(msg: String) -> void:
	_passed += 1
	print("  PASS: ", msg)


func _fail(msg: String) -> void:
	_failed += 1
	printerr("  FAIL: ", msg)


# ── Checks ─────────────────────────────────────────────────────────────────

func _check_children(root: Node) -> void:
	print("\n── Children ──")
	var names: Array[String] = []
	for c in root.get_children():
		names.append(c.name)

	for required in ["AnimationPlayer", "AnimationTree", "PlayerAnimController"]:
		if required in names:
			_pass("root has child '%s'" % required)
		else:
			_fail("root missing child '%s'" % required)


func _check_animation_player(root: Node) -> void:
	print("\n── AnimationPlayer ──")
	var ap: AnimationPlayer = root.get_node_or_null("AnimationPlayer") as AnimationPlayer
	if ap == null:
		_fail("AnimationPlayer not found")
		return

	var expected := ["idle", "walk_north", "walk_south", "walk_east", "walk_west", "attack"]
	var list := ap.get_animation_list()
	for e in expected:
		if e in list:
			var anim: Animation = ap.get_animation(e)
			if anim.get_track_count() >= 1:
				_pass("Animation '%s' exists with %d track(s)" % [e, anim.get_track_count()])
			else:
				_fail("Animation '%s' has 0 tracks" % e)
		else:
			_fail("Animation '%s' not found" % e)


func _check_animation_tree(root: Node) -> void:
	print("\n── AnimationTree ──")
	var tree: AnimationTree = root.get_node_or_null("AnimationTree") as AnimationTree
	if tree == null:
		_fail("AnimationTree not found")
		return

	# anim_player path
	if str(tree.anim_player) != "":
		_pass("AnimationTree.anim_player is set")
	else:
		_fail("AnimationTree.anim_player is empty")

	# active (should be false as built)
	if not tree.active:
		_pass("AnimationTree.active is false (as built)")
	else:
		_fail("AnimationTree.active is true (expected false)")

	# tree_root is AnimationNodeStateMachine
	var sm: AnimationNodeStateMachine = tree.tree_root as AnimationNodeStateMachine
	if sm == null:
		_fail("tree_root is not AnimationNodeStateMachine")
		return
	_pass("tree_root is AnimationNodeStateMachine")

	# Check Locomotion node
	var loco: AnimationNodeBlendSpace2D = sm.get_node("Locomotion") as AnimationNodeBlendSpace2D
	if loco == null:
		_fail("State machine missing 'Locomotion' node")
	else:
		_pass("State machine has 'Locomotion' node")
		var count := loco.get_blend_point_count()
		if count >= 5:
			_pass("Locomotion blend_point_count = %d (>= 5)" % count)
		else:
			_fail("Locomotion blend_point_count = %d (expected >= 5)" % count)

		# Check idle at (0,0)
		var found_idle := false
		for i in count:
			var pt: AnimationNode = loco.get_blend_point_node(i)
			var pos: Vector2 = loco.get_blend_point_position(i)
			var anim_node: AnimationNodeAnimation = pt as AnimationNodeAnimation
			if anim_node and anim_node.animation == &"idle":
				if pos.distance_to(Vector2.ZERO) < 0.01:
					found_idle = true
					_pass("idle blend point at (0,0)")
				else:
					_fail("idle blend point at %s (expected (0,0))" % pos)
		if not found_idle:
			_fail("No idle blend point found")

	# Check Attack node
	var atk: AnimationNodeAnimation = sm.get_node("Attack") as AnimationNodeAnimation
	if atk == null:
		_fail("State machine missing 'Attack' node")
	else:
		_pass("State machine has 'Attack' node")
		if atk.animation == &"attack":
			_pass("Attack node animation == &\"attack\"")
		else:
			_fail("Attack node animation == %s (expected &\"attack\")" % atk.animation)

	# Check transitions exist
	var has_loco_to_atk := sm.has_transition("Locomotion", "Attack")
	var has_atk_to_loco := sm.has_transition("Attack", "Locomotion")
	if has_loco_to_atk:
		_pass("Transition Locomotion -> Attack exists")
	else:
		_fail("Transition Locomotion -> Attack missing")
	if has_atk_to_loco:
		_pass("Transition Attack -> Locomotion exists")
	else:
		_fail("Transition Attack -> Locomotion missing")

	# Check transition properties using get_transition_from(idx) / get_transition_to(idx)
	if has_loco_to_atk:
		var idx := sm.find_transition("Locomotion", "Attack")
		var t: AnimationNodeStateMachineTransition = sm.get_transition_from(idx)
		if t.advance_condition == "condition_attack":
			_pass("Locomotion->Attack advance_condition = 'condition_attack'")
		else:
			_fail("Locomotion->Attack advance_condition = '%s'" % t.advance_condition)

	if has_atk_to_loco:
		var idx := sm.find_transition("Attack", "Locomotion")
		var t: AnimationNodeStateMachineTransition = sm.get_transition_to(idx)
		if t.switch_mode == AnimationNodeStateMachineTransition.SWITCH_MODE_AT_END:
			_pass("Attack->Locomotion switch_mode = AtEnd")
		else:
			_fail("Attack->Locomotion switch_mode = %d (expected AtEnd)" % t.switch_mode)


func _check_controller(root: Node) -> void:
	print("\n── PlayerAnimController ──")
	var ctrl: Node = root.get_node_or_null("PlayerAnimController")
	if ctrl == null:
		_fail("PlayerAnimController not found")
		return

	if ctrl.has_method("set_move_input"):
		_pass("PlayerAnimController has set_move_input method")
	else:
		_fail("PlayerAnimController missing set_move_input method")

	if ctrl.has_method("trigger_attack"):
		_pass("PlayerAnimController has trigger_attack method")
	else:
		_fail("PlayerAnimController missing trigger_attack method")

	if ctrl.has_method("current_state"):
		_pass("PlayerAnimController has current_state method")
	else:
		_fail("PlayerAnimController missing current_state method")


func _check_integration(root: Node) -> void:
	print("\n── Integration ──")
	var ctrl: Node = root.get_node_or_null("PlayerAnimController")
	if ctrl == null:
		_fail("Cannot run integration tests — no controller")
		return

	var tree: AnimationTree = root.get_node_or_null("AnimationTree") as AnimationTree
	if tree == null:
		_fail("Cannot run integration tests — no AnimationTree")
		return

	# Activate the tree (as the harness would)
	tree.active = true

	# Test set_move_input
	ctrl.set_move_input(Vector2(1, 0))
	var blend_pos: Vector2 = tree.get("parameters/Locomotion/blend_position")
	if blend_pos.distance_to(Vector2(1, 0)) < 0.01:
		_pass("set_move_input(Vector2(1,0)) → blend_position reads back correctly")
	else:
		_fail("set_move_input(Vector2(1,0)) → blend_position = %s" % blend_pos)

	# Test trigger_attack
	ctrl.trigger_attack()
	# Advance a couple frames
	for _i in 2:
		await get_root().process_frame

	var state: StringName = ctrl.current_state()
	if state == &"Attack":
		_pass("trigger_attack() → current_state() returns 'Attack' within 2 frames")
	else:
		_fail("trigger_attack() → current_state() returns '%s' (expected 'Attack')" % state)
