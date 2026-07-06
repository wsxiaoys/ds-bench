extends Control

@export var dialog_player: DialogPlayer

@onready var speaker_label: Label = $SpeakerLabel
@onready var body_text_label: RichTextLabel = $BodyTextLabel
@onready var choice_container: VBoxContainer = $ChoiceContainer

func _ready() -> void:
	if dialog_player:
		dialog_player.line_shown.connect(_on_line_shown)
		dialog_player.dialog_finished.connect(_on_dialog_finished)

func _on_line_shown(speaker: String, text: String, choices_labels: Array) -> void:
	if speaker_label:
		speaker_label.text = speaker
	if body_text_label:
		body_text_label.text = text
	
	if choice_container:
		for child in choice_container.get_children():
			child.queue_free()
		
		if choices_labels.is_empty():
			var next_btn = Button.new()
			next_btn.text = "Next"
			if dialog_player:
				next_btn.pressed.connect(dialog_player.advance)
			choice_container.add_child(next_btn)
		else:
			for i in range(choices_labels.size()):
				var choice_label = choices_labels[i]
				var btn = Button.new()
				btn.text = choice_label
				if dialog_player:
					btn.pressed.connect(dialog_player.advance.bind(i))
				choice_container.add_child(btn)

func _on_dialog_finished() -> void:
	if speaker_label:
		speaker_label.text = ""
	if body_text_label:
		body_text_label.text = "[Dialogue Finished]"
	if choice_container:
		for child in choice_container.get_children():
			child.queue_free()
