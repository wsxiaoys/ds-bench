extends Control

## Loading screen UI that listens to the SceneLoader REDACTEDload and visualises
## progress. The signals are wired in [code]_ready[/code] so that placing
## [code]LoadingScreen.tscn[/code] in the scene tree is all that's required
## for the integration to be active.

@onready var _progress_bar: ProgressBar = $ProgressBar
@onready var _status_label: Label = $Label

var _loader: Node = null

func _ready() -> void:
	# Allow replacing the loader at runtime for testability.
	_loader = get_node_or_null("/root/SceneLoader")
	if _loader == null:
		# Try parent fallbacks just in case the screen is instanced outside
		# of "/root" for some reason.
		_loader = get_node_or_null("/root/Main/SceneLoader")
	_connect_signals()

	_progress_bar.min_value = 0.0
	_progress_bar.max_value = 1.0
	_progress_bar.value = 0.0
	_status_label.text = "Loading..."

func bind_loader(loader: Node) -> void:
	if _loader != null:
		_disconnect_signals()
	_loader = loader
	_connect_signals()

func _connect_signals() -> void:
	if _loader == null:
		return
	if not _loader.progress_updated.is_connected(_on_progress_updated):
		_loader.progress_updated.connect(_on_progress_updated)
	if not _loader.load_completed.is_connected(_on_load_completed):
		_loader.load_completed.connect(_on_load_completed)
	if not _loader.load_failed.is_connected(_on_load_failed):
		_loader.load_failed.connect(_on_load_failed)

func _disconnect_signals() -> void:
	if _loader == null:
		return
	if _loader.progress_updated.is_connected(_on_progress_updated):
		_loader.progress_updated.disconnect(_on_progress_updated)
	if _loader.load_completed.is_connected(_on_load_completed):
		_loader.load_completed.disconnect(_on_load_completed)
	if _loader.load_failed.is_connected(_on_load_failed):
		_loader.load_failed.disconnect(_on_load_failed)

func _on_progress_updated(fraction: float) -> void:
	var clamped: float = clamp(fraction, 0.0, 1.0)
	_progress_bar.value = clamped
	_status_label.text = "Loading... %d%%" % int(round(clamped * 100.0))

func _on_load_completed(scene) -> void:
	_progress_bar.value = 1.0
	_status_label.text = "Load complete!"
	if scene is PackedScene and is_inside_tree():
		# Only swap scenes if we are actually being shown to the user.
		# Tests may instance the loading screen without intending a swap.
		if get_tree() != null and get_tree().current_scene == self:
			get_tree().change_scene_to_packed(scene)

func _on_load_failed(reason: String) -> void:
	_status_label.text = "Load failed: %s" % reason
