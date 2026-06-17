extends Node

signal step_a_complete()
signal step_b_complete()
signal step_c_complete()
signal animation_complete()

@onready var target: Node2D = $"../Target"

func get_target() -> Node2D:
	if target == null:
		target = get_node("../Target")
	return target

var _active_tween: Tween = null
var _is_running: bool = false

func play_sequence() -> Tween:
	if _active_tween and _active_tween.is_valid():
		_active_tween.kill()
	
	_is_running = true
	
	var t = get_target()
	# Reset target state to initial values
	t.position = Vector2.ZERO
	t.rotation = 0.0
	t.scale = Vector2.ONE
	t.modulate = Color(1.0, 1.0, 1.0, 1.0)
	
	_active_tween = create_tween()
	
	# Step 1: position = (200, 100) using TRANS_LINEAR, duration 1.0s
	_active_tween.tween_property(t, "position", Vector2(200, 100), 1.0)\
		.set_trans(Tween.TRANS_LINEAR)
	_active_tween.chain().tween_callback(func():
		print("EMITTING step_a_complete!")
		step_a_complete.emit()
	)
	
	# Step 2: parallel scale = (2, 2) and modulate.a = 0.5 using TRANS_LINEAR, duration 1.0s
	_active_tween.chain().tween_property(t, "scale", Vector2(2, 2), 1.0)\
		.set_trans(Tween.TRANS_LINEAR)
	_active_tween.parallel().tween_property(t, "modulate:a", 0.5, 1.0)\
		.set_trans(Tween.TRANS_LINEAR)
	_active_tween.chain().tween_callback(func():
		print("EMITTING step_b_complete!")
		step_b_complete.emit()
	)
	
	# Step 3: rotation = PI/2 using TRANS_QUAD / EASE_OUT, duration 1.0s
	_active_tween.chain().tween_property(t, "rotation", PI / 2.0, 1.0)\
		.set_trans(Tween.TRANS_QUAD)\
		.set_ease(Tween.EASE_OUT)
	_active_tween.chain().tween_callback(func():
		print("EMITTING step_c_complete!")
		step_c_complete.emit()
	)
	
	# Step 4: modulate = (0.5, 1.0, 1.0, 1.0) using TRANS_CUBIC / EASE_IN, duration 0.5s
	_active_tween.chain().tween_property(t, "modulate:r", 0.5, 0.5)\
		.set_trans(Tween.TRANS_CUBIC)\
		.set_ease(Tween.EASE_IN)
	_active_tween.parallel().tween_property(t, "modulate:a", 1.0, 0.5)\
		.set_trans(Tween.TRANS_CUBIC)\
		.set_ease(Tween.EASE_IN)
	_active_tween.chain().tween_callback(func():
		print("EMITTING animation_complete!")
		_is_running = false
		animation_complete.emit()
	)
	
	return _active_tween

func is_running() -> bool:
	return _is_running
