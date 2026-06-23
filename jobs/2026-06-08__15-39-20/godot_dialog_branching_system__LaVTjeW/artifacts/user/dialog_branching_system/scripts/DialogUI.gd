extends Control

@export var player: DialogPlayer

@onready var speaker_label = $SpeakerLabel
@onready var text_label = $RichTextLabel
@onready var choices_container = $VBoxContainer

func _ready():
	if not player and has_node("DialogPlayer"):
		player = $DialogPlayer
	if player:
		player.line_shown.connect(_on_line_shown)
		player.dialog_finished.connect(_on_dialog_finished)

func _on_line_shown(speaker: String, text: String, choices_labels: Array):
	speaker_label.text = speaker
	text_label.text = text
	
	for child in choices_container.get_children():
		child.queue_free()
		
	if choices_labels.size() > 0:
		for i in range(choices_labels.size()):
			var btn = Button.new()
			btn.text = choices_labels[i]
			btn.pressed.connect(func(): _on_choice_pressed(i))
			choices_container.add_child(btn)
	else:
		var btn = Button.new()
		btn.text = "Next"
		btn.pressed.connect(func(): _on_choice_pressed(-1))
		choices_container.add_child(btn)

func _on_choice_pressed(idx: int):
	if player:
		player.advance(idx)

func _on_dialog_finished():
	for child in choices_container.get_children():
		child.queue_free()
	speaker_label.text = ""
	text_label.text = "Dialog Ended"
