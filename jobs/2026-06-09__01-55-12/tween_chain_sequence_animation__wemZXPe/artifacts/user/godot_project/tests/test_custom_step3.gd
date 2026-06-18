## Test: node-bound tween + custom_step behavior
extends SceneTree

func _init() -> void:
	var node := Node2D.new()
	root.add_child(node)
	
	# Test 1: node.create_tween() with TWEEN_PAUSE_BOUND, then pause, then custom_step
	var tw1 := node.create_tween()
	tw1.set_pause_mode(Tween.TWEEN_PAUSE_BOUND)
	tw1.tween_property(node, "position", Vector2(200.0, 0.0), 1.0).set_trans(Tween.TRANS_LINEAR)
	tw1.pause()
	var r := tw1.custom_step(0.5)
	print("Test1 (node.create_tween, BOUND, pause, custom_step): ret=", r, " pos=", node.position)
	
	# Reset
	tw1.kill()
	node.position = Vector2.ZERO
	
	# Test 2: node.create_tween() with TWEEN_PAUSE_PROCESS, then pause, then custom_step
	var tw2 := node.create_tween()
	tw2.set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	tw2.tween_property(node, "position", Vector2(200.0, 0.0), 1.0).set_trans(Tween.TRANS_LINEAR)
	tw2.pause()
	r = tw2.custom_step(0.5)
	print("Test2 (node.create_tween, PROCESS, pause, custom_step): ret=", r, " pos=", node.position)
	
	# Reset
	tw2.kill()
	node.position = Vector2.ZERO
	
	# Test 3: get_tree().create_tween() with pause, then custom_step
	var tw3 := create_tween()
	tw3.tween_property(node, "position", Vector2(200.0, 0.0), 1.0).set_trans(Tween.TRANS_LINEAR)
	tw3.pause()
	r = tw3.custom_step(0.5)
	print("Test3 (tree.create_tween, pause, custom_step): ret=", r, " pos=", node.position)
	
	# Reset
	tw3.kill()
	node.position = Vector2.ZERO
	
	# Test 4: get_tree().create_tween() WITHOUT pause, then custom_step
	var tw4 := create_tween()
	tw4.tween_property(node, "position", Vector2(200.0, 0.0), 1.0).set_trans(Tween.TRANS_LINEAR)
	# No pause
	r = tw4.custom_step(0.5)
	print("Test4 (tree.create_tween, no pause, custom_step): ret=", r, " pos=", node.position)
	
	quit(0)
