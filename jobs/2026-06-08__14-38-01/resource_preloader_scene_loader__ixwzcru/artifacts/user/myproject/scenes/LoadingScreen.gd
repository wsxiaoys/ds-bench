extends Control

@onready var progress_bar: ProgressBar = $ProgressBar
@onready var label: Label = $Label

func _ready() -> void:
	var loader = get_node_or_null("/root/SceneLoader")
	if loader:
		print("LoadingScreen: found SceneLoader at /root/SceneLoader")
		loader.progress_updated.connect(_on_progress_updated)
		loader.load_completed.connect(_on_load_completed)
		loader.load_failed.connect(_on_load_failed)
	else:
		print("LoadingScreen: SceneLoader autoload NOT found at /root/SceneLoader!")
		push_error("SceneLoader autoload not found at /root/SceneLoader")

func _on_progress_updated(fraction: float) -> void:
	print("LoadingScreen _on_progress_updated: ", fraction)
	progress_bar.value = fraction * 100.0
	label.text = "Loading: %d%%" % int(fraction * 100.0)
	print("LoadingScreen label.text is now: ", label.text)

func _on_load_completed(_scene: PackedScene) -> void:
	print("LoadingScreen _on_load_completed")
	label.text = "Load Completed!"
	print("LoadingScreen label.text is now: ", label.text)

func _on_load_failed(reason: String) -> void:
	print("LoadingScreen _on_load_failed: ", reason)
	label.text = "Load Failed: " + reason
	print("LoadingScreen label.text is now: ", label.text)
