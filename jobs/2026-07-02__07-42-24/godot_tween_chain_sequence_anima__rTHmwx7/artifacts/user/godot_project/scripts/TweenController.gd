extends Node

signal step_a_complete()
signal step_b_complete()
signal step_c_complete()
signal animation_complete()

var _is_running: bool = true
var target: Node2D

func _ready() -> void:
	if not target:
		target = get_node("../Target")

func is_running() -> bool:
	return _is_running

func play_sequence() -> Tween:
	if not target:
		target = get_node("../Target")
	
	# Reset target to initial state
	target.position = Vector2(0, 0)
	target.rotation = 0.0
	target.scale = Vector2(1, 1)
	target.modulate = Color(1, 1, 1, 1)
	
	_is_running = true
	
	var tween = create_tween()
	
	# Step 1: Move to (200, 100) using TRANS_LINEAR over 1.0s
	tween.tween_property(target, "position", Vector2(200, 100), 1.0).set_trans(Tween.TRANS_LINEAR)
	tween.tween_callback(func():
		print("DEBUG: step_a_complete callback executed")
		emit_signal("step_a_complete")
	)
	
	# Step 2: Scale to (2, 2) and modulate.a to 0.5 in parallel using TRANS_LINEAR over 1.0s
	tween.tween_property(target, "scale", Vector2(2, 2), 1.0).set_trans(Tween.TRANS_LINEAR)
	tween.parallel().tween_property(target, "modulate:a", 0.5, 1.0).set_trans(Tween.TRANS_LINEAR)
	
	# Emit step_b_complete after Step 2 finishes
	tween.chain().tween_callback(func():
		print("DEBUG: step_b_complete callback executed")
		emit_signal("step_b_complete")
	)
	
	# Step 3: Rotate to PI/2 using TRANS_QUAD and EASE_OUT over 1.0s
	tween.tween_property(target, "rotation", PI/2, 1.0).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_callback(func():
		print("DEBUG: step_c_complete callback executed")
		emit_signal("step_c_complete")
	)
	
	# Step 4: Modulate to (0.5, 1.0, 1.0, 1.0) using TRANS_CUBIC and EASE_IN over 0.5s in parallel
	tween.tween_property(target, "modulate", Color(0.5, 1.0, 1.0, 1.0), 0.5).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	tween.parallel().tween_property(target, "position", Vector2(200, 100), 0.5).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	
	# Emit animation_complete and set _is_running to false after Step 4 finishes
	tween.chain().tween_callback(func():
		print("DEBUG: animation_complete callback executed")
		_is_running = false
		emit_signal("animation_complete")
	)
	
	return tween
