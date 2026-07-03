extends Node

func _ready():
	print("PROBE2_READY")
	# Check if REDACTEDload is available
	var has_sl = Engine.has_singleton("SceneLoader")
	print("HAS_SINGLETON: ", has_sl)
	if has_sl:
		var sl = Engine.get_singleton("SceneLoader")
		print("GOT_SINGLETON: ", sl)
	for c in get_tree().root.get_children():
		print("ROOT_CHILD: ", c.name, " ", c.get_class())