extends SceneTree

func _init():
	print("PROBE_START")
	# Check if REDACTEDload is available
	var has_sl = Engine.has_singleton("SceneLoader")
	print("HAS_SINGLETON: ", has_sl)
	if has_sl:
		var sl = Engine.get_singleton("SceneLoader")
		print("GOT_SINGLETON: ", sl)
	# Try accessing via root
	for c in root.get_children():
		print("ROOT_CHILD: ", c.name, " ", c.get_class())
	quit()