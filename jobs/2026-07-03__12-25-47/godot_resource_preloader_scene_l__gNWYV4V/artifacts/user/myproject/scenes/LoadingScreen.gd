extends Control

@onready var progress_bar: ProgressBar = $ProgressBar
@onready var label: Label = $Label

func _ready() -> void:
	var sl = get_node("/root/SceneLoader")
	if sl == null:
		return
	if sl.has_signal("progress_updated"):
		sl.progress_updated.connect(_on_progress_updated)
	if sl.has_signal("load_completed"):
		sl.load_completed.connect(_on_load_completed)
	if sl.has_signal("load_failed"):
		sl.load_failed.connect(_on_load_failed)

func _on_progress_updated(fraction: float) -> void:
	if progress_bar:
		progress_bar.value = fraction

func _on_load_completed(scene) -> void:
	if label:
		label.text = "Load completed"

func _on_load_failed(reason: String) -> void:
	if label:
		label.text = "Load failed: " + reason
