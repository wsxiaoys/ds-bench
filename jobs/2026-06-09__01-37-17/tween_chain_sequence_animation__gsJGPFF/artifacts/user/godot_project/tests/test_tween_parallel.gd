extends SceneTree

func _init():
	_run.call_deferred()

func _run():
	var obj = Node2D.new()
	root.add_child(obj)
	await process_frame
	
	var tween = create_tween()
	# Step 1: sequential
	tween.tween_property(obj, "position", Vector2(100, 100), 1.0)
	tween.tween_callback(func(): print("Callback A called!"))
	
	# Step 2: parallel
	tween.tween_property(obj, "scale", Vector2(2, 2), 1.0)
	tween.parallel().tween_property(obj, "modulate:a", 0.5, 1.0)
	tween.chain().tween_callback(func(): print("Callback B called!"))
	
	# Step 3: sequential
	tween.tween_property(obj, "rotation", 1.0, 1.0)
	tween.tween_callback(func(): print("Callback C called!"))
	
	tween.pause()
	for i in range(1, 350):
		var time = i * 0.01
		tween.custom_step(0.01)
		if time >= 0.98 and time <= 1.02:
			print("t = ", time, " pos = ", obj.position, " scale = ", obj.scale, " alpha = ", obj.modulate.a)
		if time >= 1.98 and time <= 2.02:
			print("t = ", time, " pos = ", obj.position, " scale = ", obj.scale, " alpha = ", obj.modulate.a)
		if time >= 2.98 and time <= 3.02:
			print("t = ", time, " rot = ", obj.rotation)
	quit()
