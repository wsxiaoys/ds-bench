extends Node
class_name SceneLoader

signal progress_updated(fraction)
signal load_completed(scene)
signal load_failed(reason)

func _ready():
	print("SCENELOADER_READY")