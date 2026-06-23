extends Control
class_name DialogUI

const DialogPlayer = preload("res://scripts/DialogPlayer.gd")

@export var dialog_player: DialogPlayer
@export var speaker_label: Label
@export var body_label: RichTextLabel
@export var choices_container: VBoxContainer

func _ready() -> void:
	if dialog_player == null:
		push_error("DialogUI: no DialogPlayer assigned")
		return
	dialog_player.line_shown.connect(_on_line_shown)
	dialog_player.dialog_finished.connect(_on_dialog_finished)

func _on_line_shown(speaker: String, text: String, choices_labels: Array) -> void:
	speaker_label.text = speaker
	body_label.text = text
	_rebuild_choices(choices_labels)

func _on_dialog_finished() -> void:
	queue_free()

func _rebuild_choices(labels: Array) -> void:
	for child in choices_container.get_children():
		child.queue_free()

	for i in range(labels.size()):
		var button := Button.new()
		button.text = labels[i]
		button.pressed.connect(_on_choice_pressed.bind(i))
		choices_container.add_child(button)

func _on_choice_pressed(index: int) -> void:
	dialog_player.advance(index)
