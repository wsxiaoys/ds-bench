extends SceneTree

var target = null
var controller = null
var tween = null
var count_a = 0
var count_b = 0
var count_c = 0
var count_done = 0
var step = 0
var max_steps = 360

func _initialize() -> void:
	var scene = load("res://scenes/Animator.tscn")
	var instance = scene.instantiate()
	root.add_child(instance)
	target = instance.get_node("Target")
	controller = instance.get_node("TweenController")
	print("Initial: pos=", target.position, " scale=", target.scale, " rot=", target.rotation, " mod=", target.modulate, " running=", controller.is_running())
	controller.step_a_complete.connect(func(): count_a += 1)
	controller.step_b_complete.connect(func(): count_b += 1)
	controller.step_c_complete.connect(func(): count_c += 1)
	controller.animation_complete.connect(func(): count_done += 1)
	tween = controller.play_sequence()
	tween.pause()

func _process(delta) -> bool:
	var t = float(step) * 0.01
	tween.custom_step(0.01)
	var checkpoints = [0.5, 1.0, 1.5, 2.0, 3.0, 3.5]
	if t in checkpoints:
		print("t=", t, " pos=", target.position, " scale=", target.scale, " rot=", target.rotation, " mod=", target.modulate, " a=", count_a, " b=", count_b, " c=", count_c, " done=", count_done, " running=", controller.is_running())
	step += 1
	if step >= max_steps:
		quit(0)
		return true
	return false
