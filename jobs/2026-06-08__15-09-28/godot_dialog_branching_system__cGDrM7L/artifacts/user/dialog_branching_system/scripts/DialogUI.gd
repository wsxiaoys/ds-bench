## UI controller for a dialog conversation.
## Attach to the root Control node of DialogUI.tscn.
## Assign `dialog_player` in the Inspector (or connect it at runtime via
## connect_player()) before the scene is used.
class_name DialogUI
extends Control

const DialogPlayerScript := preload("res://scripts/DialogPlayer.gd")

## The DialogPlayer driving this UI.
## Can also be assigned at runtime with connect_player().
@export var dialog_player: DialogPlayerScript

@onready var _speaker_label: Label       = $SpeakerLabel
@onready var _body_label: RichTextLabel  = $BodyText
@onready var _choices_box: VBoxContainer = $ChoicesBox


func _ready() -> void:
	if dialog_player != null:
		connect_player(dialog_player)


## Connect this UI to a DialogPlayer node at runtime.
func connect_player(player: DialogPlayerScript) -> void:
	dialog_player = player
	player.line_shown.connect(_on_line_shown)
	player.dialog_finished.connect(_on_dialog_finished)


# ── signal handlers ────────────────────────────────────────────────────────────

func _on_line_shown(speaker: String, text: String, choices_labels: Array) -> void:
	_speaker_label.text = speaker
	_body_label.text    = text
	_rebuild_choices(choices_labels)


func _on_dialog_finished() -> void:
	_speaker_label.text = ""
	_body_label.text    = "[Dialog ended]"
	_rebuild_choices([])


# ── private helpers ────────────────────────────────────────────────────────────

func _rebuild_choices(labels: Array) -> void:
	# Remove all existing choice buttons.
	for child in _choices_box.get_children():
		child.queue_free()

	# Create a button for each visible choice.
	for i in labels.size():
		var btn := Button.new()
		btn.text = labels[i]
		# Capture the index for the lambda closure.
		var idx := i
		btn.pressed.connect(func() -> void:
			if dialog_player != null:
				dialog_player.advance(idx)
		)
		_choices_box.add_child(btn)
