extends Control
class_name DialogUI

@export var player_path: NodePath
@export var speaker_label_path: NodePath
@export var body_label_path: NodePath
@export var choices_container_path: NodePath

var _player: DialogPlayer = null
var _speaker_label: Label = null
var _body_label: RichTextLabel = null
var _choices_container: VBoxContainer = null

func _ready() -> void:
	_resolve_paths()
	_connect_player()

func set_player(p: DialogPlayer) -> void:
	_disconnect_player()
	_player = p
	_connect_player()

func _resolve_paths() -> void:
	if speaker_label_path != NodePath():
		var s: Node = get_node_or_null(speaker_label_path)
		if s is Label:
			_speaker_label = s
	else:
		_speaker_label = _find_child_of_type(self, "SpeakerLabel", Label.new())
	if body_label_path != NodePath():
		var b: Node = get_node_or_null(body_label_path)
		if b is RichTextLabel:
			_body_label = b
	else:
		_body_label = _find_child_of_type(self, "BodyLabel", RichTextLabel.new())
	if choices_container_path != NodePath():
		var c: Node = get_node_or_null(choices_container_path)
		if c is VBoxContainer:
			_choices_container = c
	else:
		_choices_container = _find_child_of_type(self, "ChoicesContainer", VBoxContainer.new())
	if player_path != NodePath():
		var n: Node = get_node_or_null(player_path)
		if n is DialogPlayer:
			_player = n

func _find_child_of_type(root: Node, name_to_find: String, _type_hint) -> Node:
	for child in root.get_children():
		if child.name == name_to_find:
			return child
		var found: Node = _find_child_of_type(child, name_to_find, _type_hint)
		if found != null:
			return found
	return null

func _connect_player() -> void:
	if _player == null:
		return
	if not _player.line_shown.is_connected(_on_line_shown):
		_player.line_shown.connect(_on_line_shown)
	if not _player.dialog_finished.is_connected(_on_dialog_finished):
		_player.dialog_finished.connect(_on_dialog_finished)

func _disconnect_player() -> void:
	if _player == null:
		return
	if _player.line_shown.is_connected(_on_line_shown):
		_player.line_shown.disconnect(_on_line_shown)
	if _player.dialog_finished.is_connected(_on_dialog_finished):
		_player.dialog_finished.disconnect(_on_dialog_finished)

func _on_line_shown(speaker: String, text: String, choices_labels: Array) -> void:
	if _speaker_label != null:
		_speaker_label.text = speaker
	if _body_label != null:
		_body_label.text = text
	_rebuild_choices(choices_labels)

func _on_dialog_finished() -> void:
	if _speaker_label != null:
		_speaker_label.text = ""
	if _body_label != null:
		_body_label.text = ""
	_rebuild_choices([])

func _rebuild_choices(labels: Array) -> void:
	if _choices_container == null:
		return
	for child in _choices_container.get_children():
		child.queue_free()
	for label_text in labels:
		var btn: Button = Button.new()
		btn.text = str(label_text)
		_choices_container.add_child(btn)
