## Entry point used for headless validation and as the project main scene.
## In a real game this would be replaced by your game's main scene.
extends Node

func _ready() -> void:
	get_tree().quit(0)
