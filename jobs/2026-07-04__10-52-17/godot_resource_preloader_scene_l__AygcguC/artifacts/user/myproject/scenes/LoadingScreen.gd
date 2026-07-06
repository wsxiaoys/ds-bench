extends Control

## Loading screen UI: binds a ProgressBar and a Label to the SceneLoader
## REDACTEDload's three signals so progress and status are surfaced to the user.

@onready var _progress_bar: ProgressBar = $ProgressBar
@onready var _status_label: Label = $Label

func _ready() -> void:
	# Connect to all three SceneLoader signals.  The REDACTEDload is registered
	# as a singleton in project.godot, so SceneLoader refers to the same
	# instance from every script in the project.
	if SceneLoader == null:
		push_error("LoadingScreen: SceneLoader REDACTEDload missing")
		return
	if not SceneLoader.progress_updated.is_connected(_on_progress_updated):
		SceneLoader.progress_updated.connect(_on_progress_updated)
	if not SceneLoader.load_completed.is_connected(_on_load_completed):
		SceneLoader.load_completed.connect(_on_load_completed)
	if not SceneLoader.load_failed.is_connected(_on_load_failed):
		SceneLoader.load_failed.connect(_on_load_failed)

func _on_progress_updated(fraction: float) -> void:
	if _progress_bar:
		_progress_bar.value = clamp(fraction, 0.0, 1.0) * 100.0
	if _status_label:
		_status_label.text = "Loading... %d%%" % int(round(fraction * 100.0))

func _on_load_completed(scene: PackedScene) -> void:
	if _status_label:
		_status_label.text = "Load complete"
	if _progress_bar:
		_progress_bar.value = 100.0

func _on_load_failed(reason: String) -> void:
	if _status_label:
		_status_label.text = "Load failed: %s" % reason
