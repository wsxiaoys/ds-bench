extends Control

@onready var progress_bar: ProgressBar = $ProgressBar
@onready var label: Label = $Label

func _ready() -> void:
	# Autoloads are children of the root viewport at path /root/SceneLoader.
	var sl: Node = get_node_or_null("/root/SceneLoader")
	if sl == null:
		push_error("LoadingScreen: SceneLoader autoload not found at /root/SceneLoader")
		return

	sl.progress_updated.connect(_on_progress_updated)
	sl.load_completed.connect(_on_load_completed)
	sl.load_failed.connect(_on_load_failed)


func _on_progress_updated(fraction: float) -> void:
	progress_bar.value = fraction * 100.0
	label.text = "Loading… %d%%" % int(fraction * 100.0)


func _on_load_completed(_scene: PackedScene) -> void:
	label.text = "Done!"
	progress_bar.value = 100.0


func _on_load_failed(reason: String) -> void:
	label.text = "Load failed: " + reason
	progress_bar.value = 0.0
