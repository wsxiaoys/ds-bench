extends SceneTree


const SCENE_PATH := "res://scenes/Player.tscn"
const OUTPUT_PATH := "res://harness_output.json"


func _process_frames(n: int) -> void:
	for i in n:
		# Advance one full main-loop iteration (handles _process and timers).
		await process_frame


func _emit(results: Dictionary) -> void:
	var ok := true
	for k in results.keys():
		if typeof(results[k]) == TYPE_BOOL and not results[k]:
			ok = false
			break
		if typeof(results[k]) == TYPE_DICTIONARY and results[k].has("ok") and not results[k]["ok"]:
			ok = false
			break
	var payload := {"ok": ok, "results": results}
	var f := FileAccess.open(OUTPUT_PATH, FileAccess.WRITE)
	if f == null:
		push_error("Failed to open output file")
		quit(2)
		return
	f.store_string(JSON.stringify(payload, "  "))
	f.close()
	print("HARNESS_OUTPUT_PATH=" + ProjectSettings.globalize_path(OUTPUT_PATH))
	print("HARNESS_OK=" + str(ok))
	quit(0 if ok else 1)


func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var results: Dictionary = {}
	var packed: PackedScene = load(SCENE_PATH) as PackedScene
	results["scene_loaded"] = packed != null
	if packed == null:
		_emit(results)
		return
	var root: Node = packed.instantiate()
	results["scene_instantiated"] = root != null
	if root == null:
		_emit(results)
		return
	root_node_attach(root)
	await process_frame

	# Locate nodes
	var anim_player: AnimationPlayer = root.find_child("AnimationPlayer", true, false) as AnimationPlayer
	var anim_tree: AnimationTree = root.find_child("AnimationTree", true, false) as AnimationTree
	var controller: Node = root.find_child("PlayerAnimController", true, false)
	results["found_animation_player"] = anim_player != null
	results["found_animation_tree"] = anim_tree != null
	results["found_controller"] = controller != null
	if anim_player == null or anim_tree == null or controller == null:
		_emit(results)
		return

	# Required animations
	var required := ["idle", "walk_north", "walk_south", "walk_east", "walk_west", "attack"]
	var anim_results: Dictionary = {}
	var all_anims_ok := true
	for name in required:
		var present := anim_player.has_animation(name)
		anim_results[name] = present
		if not present:
			all_anims_ok = false
	results["animations"] = {"ok": all_anims_ok, "detail": anim_results}

	# Tree root is state machine
	var tree_root: AnimationNode = anim_tree.tree_root
	var sm := tree_root as AnimationNodeStateMachine
	results["tree_root_is_state_machine"] = sm != null
	if sm == null:
		_emit(results)
		return

	var has_loc := sm.has_node("Locomotion")
	var has_atk := sm.has_node("Attack")
	results["state_machine_has_locomotion"] = has_loc
	results["state_machine_has_attack"] = has_atk
	if not (has_loc and has_atk):
		_emit(results)
		return

	# Locomotion is blend space 2d with >=5 points
	var loc_node: AnimationNode = sm.get_node("Locomotion")
	var bs := loc_node as AnimationNodeBlendSpace2D
	results["locomotion_is_blend_space_2d"] = bs != null
	if bs != null:
		results["blend_point_count"] = bs.get_blend_point_count()
		results["blend_point_count_ok"] = bs.get_blend_point_count() >= 5
	else:
		results["blend_point_count"] = 0
		results["blend_point_count_ok"] = false

	# Attack node is AnimationNodeAnimation referencing 'attack'
	var atk_node: AnimationNode = sm.get_node("Attack")
	var atk_anim := atk_node as AnimationNodeAnimation
	results["attack_is_animation_node"] = atk_anim != null
	if atk_anim != null:
		results["attack_animation_name"] = String(atk_anim.animation)
		results["attack_animation_name_ok"] = String(atk_anim.animation) == "attack"
	else:
		results["attack_animation_name_ok"] = false

	# Activate the tree
	anim_tree.active = true
	await process_frame
	results["tree_active"] = anim_tree.active == true

	# set_move_input -> blend_position
	if controller.has_method("set_move_input"):
		controller.set_move_input(Vector2(1, 0))
		await process_frame
		var bp = anim_tree.get("parameters/Locomotion/blend_position")
		results["blend_position_raw"] = str(bp)
		var ok_bp := false
		if typeof(bp) == TYPE_VECTOR2:
			ok_bp = absf((bp as Vector2).x - 1.0) < 0.01 and absf((bp as Vector2).y - 0.0) < 0.01
		results["blend_position_ok"] = ok_bp
	else:
		results["blend_position_ok"] = false

	# trigger_attack -> current_state becomes "Attack" within 2 frames
	if controller.has_method("trigger_attack") and controller.has_method("current_state"):
		controller.trigger_attack()
		var transitioned := false
		for i in 4:
			await process_frame
			var s = controller.current_state()
			if String(s) == "Attack":
				transitioned = true
				break
		results["transitioned_to_attack"] = transitioned
	else:
		results["transitioned_to_attack"] = false

	_emit(results)


func root_node_attach(node: Node) -> void:
	root.add_child(node)
