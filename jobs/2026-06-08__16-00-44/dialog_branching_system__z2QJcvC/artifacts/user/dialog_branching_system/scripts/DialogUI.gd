extends Control

@onready var speaker_label: Label = $SpeakerLabel
@onready var body_label: RichTextLabel = $BodyLabel
@onready var choices_container: VBoxContainer = $ChoicesContainer

var _player: Node


func set_dialog_player(player: Node) -> void:
	if _player != null:
		_player.line_shown.disconnect(_on_line_shown)
	_player = player
	if _player != null:
		_player.line_shown.connect(_on_line_shown)


func _on_line_shown(speaker: String, text: String, choices_labels: Array) -> void:
	speaker_label.text = speaker
	body_label.text = text

	# Clear existing choice buttons
	for child in choices_container.get_children():
		child.queue_free()

	# Create new choice buttons
	for i in choices_labels.size():
		var button: Button = Button.new()
		button.text = choices_labels[i]
		var idx: int = i
		button.pressed.connect(func() -> void:
			_player.advance(idx)
		)
		choices_container.add_child(button)