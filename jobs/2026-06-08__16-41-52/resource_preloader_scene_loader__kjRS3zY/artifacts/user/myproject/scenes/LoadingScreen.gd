extends Control

@onready var progress_bar: ProgressBar = $ProgressBar
@onready var status_label: Label = $Label


func _ready() -> void:
	SceneLoader.progress_updated.connect(_on_progress_updated)
	SceneLoader.load_completed.connect(_on_load_completed)
	SceneLoader.load_failed.connect(_on_load_failed)


func _on_progress_updated(fraction: float) -> void:
	progress_bar.value = fraction * 100.0
	status_label.text = "Loading... %d%%" % int(fraction * 100.0)


func _on_load_completed(_scene: PackedScene) -> void:
	progress_bar.value = 100.0
	status_label.text = "Load complete!"


func _on_load_failed(reason: String) -> void:
	status_label.text = "Load failed: " + reason
