extends Node

func _ready() -> void:
	var ev := InputEventKey.new()
	
	print("=== Testing keycode assignment ===")
	ev.physical_keycode = KEY_SPACE
	print("  After setting physical_keycode=KEY_SPACE:")
	print("    keycode = %d" % ev.keycode)
	print("    physical_keycode = %d" % ev.physical_keycode)
	print("    as_text = %s" % ev.as_text())
	
	ev.keycode = KEY_SPACE
	print("  After setting keycode=KEY_SPACE:")
	print("    keycode = %d" % ev.keycode)
	print("    physical_keycode = %d" % ev.physical_keycode)
	print("    as_text = %s" % ev.as_text())
	
	get_tree().quit()
