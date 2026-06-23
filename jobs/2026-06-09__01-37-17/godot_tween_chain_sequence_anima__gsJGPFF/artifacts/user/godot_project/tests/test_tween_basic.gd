extends SceneTree

func _init():
	_run.call_deferred()

func _run():
	var obj = Node2D.new()
	root.add_child(obj)
	await process_frame
	
	var tween = create_tween()
	tween.tween_property(obj, "position", Vector2(100, 100), 1.0)
	tween.tween_callback(func(): print("Callback 1 called!"))
	tween.tween_property(obj, "position", Vector2(200, 200), 1.0)
	tween.tween_callback(func(): print("Callback 2 called!"))
	
	tween.pause()
	for i in range(1, 250):
		var time = i * 0.01
		tween.custom_step(0.01)
		if time >= 0.98 and time <= 1.02:
			print("t = ", time, " pos = ", obj.position)
		if time >= 1.98 and time <= 2.02:
			print("t = ", time, " pos = ", obj.position)
	quit()
