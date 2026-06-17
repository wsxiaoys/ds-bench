extends Node

signal step_a_complete
signal step_b_complete
signal step_c_complete
signal animation_complete

var _is_running: bool = false
var _tween: Tween

func play_sequence() -> Tween:
	var target = get_node("../Target")
	_tween = get_tree().create_tween()
	_is_running = true
	
	# Step 1
	_tween.tween_property(target, "position", Vector2(200, 100), 1.0).set_trans(Tween.TRANS_LINEAR)
	_tween.tween_callback(func(): step_a_complete.emit())
	
	# Step 2
	_tween.set_parallel(true)
	_tween.tween_property(target, "scale", Vector2(2, 2), 1.0).set_trans(Tween.TRANS_LINEAR)
	_tween.tween_property(target, "modulate:a", 0.5, 1.0).set_trans(Tween.TRANS_LINEAR)
	_tween.chain()
	_tween.tween_callback(func(): step_b_complete.emit())
	
	# Step 3
	_tween.tween_property(target, "rotation", PI / 2.0, 1.0).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_tween.tween_callback(func(): step_c_complete.emit())
	
	# Step 4
	_tween.set_parallel(true)
	_tween.tween_property(target, "modulate", Color(0.5, 1.0, 1.0, 1.0), 0.5).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	_tween.chain()
	_tween.tween_callback(func():
		_is_running = false
		animation_complete.emit()
	)
	
	return _tween

func is_running() -> bool:
	return _is_running
