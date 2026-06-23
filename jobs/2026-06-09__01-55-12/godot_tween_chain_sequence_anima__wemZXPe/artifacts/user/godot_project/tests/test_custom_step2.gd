## Test custom_step with process frames
extends SceneTree

var node : Node2D
var tw : Tween
var steps_done := 0
var target_steps := 50

func _init() -> void:
	node = Node2D.new()
	root.add_child(node)
	
	# Create via SceneTree
	tw = create_tween()
	tw.tween_property(node, "position", Vector2(200.0, 100.0), 1.0) \
		.set_trans(Tween.TRANS_LINEAR)
	tw.pause()
	
	print("Created tween, paused. is_running=", tw.is_running(), " is_valid=", tw.is_valid())
	# Try one custom_step
	var result = tw.custom_step(0.5)
	print("custom_step(0.5) returned: ", result, " pos=", node.position)

func _process(delta: float) -> bool:
	steps_done += 1
	if steps_done <= target_steps:
		tw.custom_step(0.01)
		if steps_done == target_steps:
			print("After ", target_steps, " process steps: pos=", node.position)
			quit(0)
	return false
