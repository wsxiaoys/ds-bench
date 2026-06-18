extends SceneTree

func _init():
	_run.call_deferred()

func _run():
	var obj = Node2D.new()
	root.add_child(obj)
	await process_frame
	
	var tween = create_tween()
	tween.tween_property(obj, "position", Vector2(100, 100), 1.0)
	tween.chain().tween_callback(func(): print("Callback A called!"))
	tween.chain().tween_property(obj, "scale", Vector2(2, 2), 1.0)
	
	tween.pause()
	for i in range(1, 150):
		tween.custom_step(0.01)
	quit()
