extends SceneTree
func load() -> void:
    print("load called")
    quit()
func _init():
    self.load()
