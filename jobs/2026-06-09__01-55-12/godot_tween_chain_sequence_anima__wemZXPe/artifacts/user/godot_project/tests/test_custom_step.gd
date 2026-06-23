## Minimal test for custom_step behavior on a paused tween.
extends SceneTree

func _init() -> void:
	# Create a simple Node2D in the tree
	var node := Node2D.new()
	root.add_child(node)
	
	# Create tween via node (so it's in the tree)
	var tw: Tween = node.create_tween()
	tw.tween_property(node, "position", Vector2(200.0, 100.0), 1.0) \
		.set_trans(Tween.TRANS_LINEAR)
	
	# Do NOT pause — leave it running; custom_step works on running tweens
	print("is_running: ", tw.is_running())
	print("pos before step: ", node.position)
	
	# Advance 0.5 s
	for i in 50:
		tw.custom_step(0.01)
	
	print("pos after 0.5s: ", node.position)
	
	# Also test: pause → custom_step
	tw.pause()
	print("is_running after pause: ", tw.is_running())
	for i in 50:
		tw.custom_step(0.01)
	print("pos after pause+50 steps: ", node.position)
	
	# play → custom_step
	tw.play()
	for i in 50:
		tw.custom_step(0.01)
	print("pos after play+50 steps: ", node.position)
	
	quit(0)
