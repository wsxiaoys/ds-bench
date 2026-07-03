extends Node

@export var tree: DialogTree

var _player: DialogPlayer


func _ready() -> void:
	_player = DialogPlayer.new()
	_player.name = "DialogPlayer"
	_player.tree = tree
	add_child(_player)

	var ui_scene: PackedScene = load("res://scenes/DialogUI.tscn")
	if ui_scene == null:
		push_error("Main: could not load DialogUI scene.")
		return
	var ui: Control = ui_scene.instantiate()
	ui.name = "DialogUI"
	ui.player = _player
	add_child(ui)

	_player.start()
