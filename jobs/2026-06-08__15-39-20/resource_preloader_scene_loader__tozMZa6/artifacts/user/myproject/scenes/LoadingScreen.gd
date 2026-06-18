extends Control

func _ready():
	var loader = get_node("/root/SceneLoader")
	if loader:
		loader.progress_updated.connect(_on_progress_updated)
		loader.load_completed.connect(_on_load_completed)
		loader.load_failed.connect(_on_load_failed)

func _on_progress_updated(fraction: float):
	$ProgressBar.value = fraction * 100.0

func _on_load_completed(scene: PackedScene):
	$Label.text = "Completed"

func _on_load_failed(reason: String):
	$Label.text = "Failed: " + reason
