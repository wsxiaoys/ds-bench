extends Control

@onready var progress_bar: ProgressBar = $ProgressBar
@onready var label: Label = $Label

func _ready() -> void:
	# Connect to SceneLoader signals
	SceneLoader.progress_updated.connect(_on_progress_updated)
	SceneLoader.load_completed.connect(_on_load_completed)
	SceneLoader.load_failed.connect(_on_load_failed)

func _on_progress_updated(fraction: float) -> void:
	if progress_bar:
		progress_bar.value = fraction
	if label:
		label.text = "Loading... %d%%" % int(fraction * 100)

func _on_load_completed(_scene: PackedScene) -> void:
	if label:
		label.text = "Load Completed!"

func _on_load_failed(reason: String) -> void:
	if label:
		label.text = "Load Failed: " + reason
