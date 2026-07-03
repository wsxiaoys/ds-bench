extends SceneTree

func _init():
	call_deferred("run_test")

func run_test():
	var root_node = root
	var node = Node2D.new()
	root_node.add_child(node)
	
	var tween = node.create_tween()
	tween.pause()
	
	# Set parallel
	tween.set_parallel(true)
	
	# Add property tween (duration 1.0)
	tween.tween_property(node, "position", Vector2(200, 100), 1.0)
	
	# Add interval (duration 0.99) and then a chained callback
	tween.tween_interval(0.99)
	tween.chain().tween_callback(func():
		print("CALLBACK executed! Tween elapsed: ", tween.get_total_elapsed_time())
	)
	
	for i in range(105):
		tween.custom_step(0.01)
		var t = (i + 1) * 0.01
		print("Step %3d (t=%.2f): elapsed=%.6f, pos=%s" % [i, t, tween.get_total_elapsed_time(), node.position])
		
	node.queue_free()
	quit()
