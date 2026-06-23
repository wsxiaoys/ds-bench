extends SceneTree
func _init():
	var file = FileAccess.open("res://autoloads/SceneLoader.gd", FileAccess.READ)
	var content = file.get_as_text()
	file = FileAccess.open("res://autoloads/SceneLoader.gd", FileAccess.WRITE)
	file.store_string(content.replace("class_name SceneLoader", "#class_name SceneLoader"))
	file.close()
	
	var script = load("res://autoloads/SceneLoader.gd")
	script.reload()
	var instance = script.new()
	instance.name = "SceneLoader"
	root.add_child(instance)
	print("Autoload added: ", root.get_node("SceneLoader"))
	
	file = FileAccess.open("res://autoloads/SceneLoader.gd", FileAccess.WRITE)
	file.store_string(content)
	file.close()
	quit()
