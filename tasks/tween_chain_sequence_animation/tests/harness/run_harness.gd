extends SceneTree


const SCENE_PATH := "res://scenes/Animator.tscn"
const OUTPUT_PATH := "res://harness_output.json"
const DT := 0.01
const TOTAL_STEPS := 360  # 3.60 seconds, slight overshoot of the 3.5s sequence


var _signal_counts := {
	"step_a_complete": 0,
	"step_b_complete": 0,
	"step_c_complete": 0,
	"animation_complete": 0,
}
var _signal_step := {
	"step_a_complete": -1,
	"step_b_complete": -1,
	"step_c_complete": -1,
	"animation_complete": -1,
}
var _current_step := 0


func _on_step_a() -> void:
	_signal_counts["step_a_complete"] += 1
	if _signal_step["step_a_complete"] < 0:
		_signal_step["step_a_complete"] = _current_step


func _on_step_b() -> void:
	_signal_counts["step_b_complete"] += 1
	if _signal_step["step_b_complete"] < 0:
		_signal_step["step_b_complete"] = _current_step


func _on_step_c() -> void:
	_signal_counts["step_c_complete"] += 1
	if _signal_step["step_c_complete"] < 0:
		_signal_step["step_c_complete"] = _current_step


func _on_complete() -> void:
	_signal_counts["animation_complete"] += 1
	if _signal_step["animation_complete"] < 0:
		_signal_step["animation_complete"] = _current_step


func _init() -> void:
	call_deferred("_run")


func _emit(results: Dictionary) -> void:
	var payload := {"results": results}
	var f := FileAccess.open(OUTPUT_PATH, FileAccess.WRITE)
	if f == null:
		push_error("Failed to open output file")
		quit(2)
		return
	f.store_string(JSON.stringify(payload, "  "))
	f.close()
	print("HARNESS_OUTPUT_PATH=" + ProjectSettings.globalize_path(OUTPUT_PATH))
	quit(0)


func _sample(target: Node2D) -> Dictionary:
	return {
		"position": [target.position.x, target.position.y],
		"rotation": target.rotation,
		"scale": [target.scale.x, target.scale.y],
		"modulate": [target.modulate.r, target.modulate.g, target.modulate.b, target.modulate.a],
		"signal_counts": _signal_counts.duplicate(true),
	}


func _run() -> void:
	var results: Dictionary = {}
	var packed: PackedScene = load(SCENE_PATH) as PackedScene
	results["scene_loaded"] = packed != null
	if packed == null:
		_emit(results)
		return

	var scene_root: Node = packed.instantiate()
	results["scene_instantiated"] = scene_root != null
	if scene_root == null:
		_emit(results)
		return
	root.add_child(scene_root)
	await process_frame

	results["root_is_node2d"] = scene_root is Node2D
	var target: Node2D = scene_root.find_child("Target", true, false) as Node2D
	var controller: Node = scene_root.find_child("TweenController", true, false)
	results["target_found"] = target != null
	results["controller_found"] = controller != null
	if target == null or controller == null:
		_emit(results)
		return

	# Initial state capture (must match required spec)
	results["initial_position"] = [target.position.x, target.position.y]
	results["initial_rotation"] = target.rotation
	results["initial_scale"] = [target.scale.x, target.scale.y]
	results["initial_modulate"] = [target.modulate.r, target.modulate.g, target.modulate.b, target.modulate.a]

	# Required signal presence
	var required_signals := ["step_a_complete", "step_b_complete", "step_c_complete", "animation_complete"]
	var declared := {}
	var all_declared := true
	for s in required_signals:
		var present := controller.has_signal(s)
		declared[s] = present
		if not present:
			all_declared = false
	results["signals_declared"] = declared
	results["all_signals_declared"] = all_declared
	if not all_declared:
		_emit(results)
		return

	controller.connect("step_a_complete", Callable(self, "_on_step_a"))
	controller.connect("step_b_complete", Callable(self, "_on_step_b"))
	controller.connect("step_c_complete", Callable(self, "_on_step_c"))
	controller.connect("animation_complete", Callable(self, "_on_complete"))

	# play_sequence presence
	if not controller.has_method("play_sequence"):
		results["has_play_sequence"] = false
		_emit(results)
		return
	results["has_play_sequence"] = true

	var tween_obj = controller.call("play_sequence")
	var tween: Tween = tween_obj as Tween
	results["tween_returned"] = tween != null
	if tween == null:
		_emit(results)
		return

	# Pause so we can drive deterministically
	tween.pause()
	await process_frame

	# Step indices for the checkpoints (DT = 0.01s -> step 50 = 0.5s, etc.)
	var checkpoint_map := {
		50: "t_0_50",
		100: "t_1_00",
		150: "t_1_50",
		200: "t_2_00",
		300: "t_3_00",
		350: "t_3_50",
	}
	var samples := {}

	_current_step = 0
	while _current_step < TOTAL_STEPS:
		tween.custom_step(DT)
		_current_step += 1
		if checkpoint_map.has(_current_step):
			samples[checkpoint_map[_current_step]] = _sample(target)

	# After full overshoot, capture final
	samples["t_final"] = _sample(target)

	# is_running query
	var is_running_final := true
	if controller.has_method("is_running"):
		is_running_final = bool(controller.call("is_running"))
	results["is_running_after_complete"] = is_running_final

	results["samples"] = samples
	results["signal_counts"] = _signal_counts
	results["signal_first_step"] = _signal_step
	results["tween_is_valid_after"] = tween != null and is_instance_valid(tween)
	results["target_classname"] = target.get_class()
	results["controller_classname"] = controller.get_class()

	_emit(results)
