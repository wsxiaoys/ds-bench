extends Control

@onready var progress_bar: ProgressBar = $ProgressBar
@onready var label: Label = $Label

func _ready() -> void:
	var loader = Engine.get_singleton("SceneLoader") if Engine.has_singleton("SceneLoader") else null
	if loader == null:
		loader = get_node_or_null("/root/SceneLoader")
	if loader != null:
		loader.progress_updated.connect(_on_progress_updated)
		loader.load_completed.connect(_on_load_completed)
		loader.load_failed.connect(_on_load_failed)
	progress_bar.value = 0.0
	label.text = "Loading..."

func _on_progress_updated(fraction: float) -> void:
	progress_bar.value = fraction

func _on_load_completed(_scene) -> void:
	label.text = "Done!"
	progress_bar.value = 1.0

func _on_load_failed(reason) -> void:
	label.text = "Failed: " + str(reason)
