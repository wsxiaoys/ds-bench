extends Control

@export var player: DialogPlayer

@onready var _speaker_label: Label = $SpeakerLabel
@onready var _body_text: RichTextLabel = $BodyText
@onready var _choices_container: VBoxContainer = $ChoicesContainer


func _ready() -> void:
	if player == null:
		# Try to find a DialogPlayer in the parent as a convenience.
		var parent := get_parent()
		if parent != null:
			var found := parent.get_node_or_null("DialogPlayer")
			if found is DialogPlayer:
				player = found
	if player != null:
		player.line_shown.connect(_on_line_shown)
		player.dialog_finished.connect(_on_dialog_finished)
	else:
		push_warning("DialogUI: no DialogPlayer assigned or found in parent.")


func _on_line_shown(speaker: String, text: String, choices_labels: Array) -> void:
	_speaker_label.text = speaker
	_body_text.text = text

	_clear_choices()

	if choices_labels.is_empty():
		var continue_button := Button.new()
		continue_button.text = "Continue"
		continue_button.pressed.connect(_on_continue_pressed)
		_choices_container.add_child(continue_button)
		return

	for i in choices_labels.size():
		var label_text: String = choices_labels[i]
		var choice_index := i
		var choice_button := Button.new()
		choice_button.text = label_text
		choice_button.pressed.connect(_on_choice_pressed.bind(choice_index))
		_choices_container.add_child(choice_button)


func _on_dialog_finished() -> void:
	_speaker_label.text = ""
	_body_text.text = ""
	_clear_choices()


func _clear_choices() -> void:
	for child in _choices_container.get_children():
		child.queue_free()


func _on_choice_pressed(choice_index: int) -> void:
	if player != null:
		player.advance(choice_index)


func _on_continue_pressed() -> void:
	if player != null:
		player.advance(-1)
