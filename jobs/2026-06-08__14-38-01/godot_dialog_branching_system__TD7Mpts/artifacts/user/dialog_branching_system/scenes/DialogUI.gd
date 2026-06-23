extends Control
class_name DialogUI

@export var player: DialogPlayer

@export var speaker_label: Label
@export var body_text: RichTextLabel
@export var choices_container: VBoxContainer

func _ready() -> void:
	# Fallback to finding them by name/type if not explicitly assigned
	if not speaker_label:
		speaker_label = find_child("SpeakerLabel") as Label
		if not speaker_label:
			speaker_label = find_child("*Speaker*") as Label
	if not body_text:
		body_text = find_child("BodyText") as RichTextLabel
		if not body_text:
			body_text = find_child("*RichText*") as RichTextLabel
	if not choices_container:
		choices_container = find_child("ChoicesContainer") as VBoxContainer
		if not choices_container:
			choices_container = find_child("*VBox*") as VBoxContainer
			
	if player:
		player.line_shown.connect(_on_line_shown)
		player.dialog_finished.connect(_on_dialog_finished)

func _on_line_shown(speaker: String, text: String, choices_labels: Array) -> void:
	if speaker_label:
		speaker_label.text = speaker
	if body_text:
		body_text.text = text
	
	if choices_container:
		# Clear existing buttons
		for child in choices_container.get_children():
			child.queue_free()
		
		if choices_labels.is_empty():
			var button = Button.new()
			button.text = "Continue"
			if player:
				button.pressed.connect(func(): player.advance(-1))
			choices_container.add_child(button)
		else:
			for i in range(choices_labels.size()):
				var label_text = choices_labels[i]
				var button = Button.new()
				button.text = label_text
				if player:
					button.pressed.connect(func(): player.advance(i))
				choices_container.add_child(button)

func _on_dialog_finished() -> void:
	hide()
