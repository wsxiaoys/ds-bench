extends Node
class_name DialogPlayer

const DialogTree = preload("res://scripts/DialogTree.gd")
const DialogNode = preload("res://scripts/DialogNode.gd")
const DialogChoice = preload("res://scripts/DialogChoice.gd")

@export var tree: DialogTree

var _current_node: DialogNode = null
var _flags: Dictionary = {}

signal line_shown(speaker: String, text: String, choices_labels: Array)
signal dialog_finished()

func set_flag(name: StringName) -> void:
	_flags[name] = true

func has_flag(name: StringName) -> bool:
	if name == &"":
		return true
	return _flags.get(name, false)

func start() -> void:
	if tree == null:
		push_error("DialogPlayer: no DialogTree assigned")
		return
	var node = tree.get_node(tree.start_id)
	if node == null:
		push_error("DialogPlayer: start_id not found in tree")
		return
	_current_node = node
	_emit_line()

func advance(choice_index: int = -1) -> void:
	if _current_node == null:
		return

	var next_id: StringName = &""

	if _current_node.choices.size() > 0:
		var visible = _get_visible_choices()
		if choice_index < 0 or choice_index >= visible.size():
			push_error("DialogPlayer: invalid choice_index %d" % choice_index)
			return
		next_id = visible[choice_index].next_id
	else:
		next_id = _current_node.next_id

	if next_id == &"":
		_current_node = null
		dialog_finished.emit()
		return

	var node = tree.get_node(next_id)
	if node == null:
		push_error("DialogPlayer: node with id '%s' not found" % next_id)
		_current_node = null
		dialog_finished.emit()
		return

	_current_node = node
	_emit_line()

func _get_visible_choices() -> Array[DialogChoice]:
	var visible: Array[DialogChoice] = []
	for choice in _current_node.choices:
		if choice.condition_flag == &"" or has_flag(choice.condition_flag):
			visible.append(choice)
	return visible

func _emit_line() -> void:
	var labels: Array = []
	for choice in _get_visible_choices():
		labels.append(choice.label)
	line_shown.emit(_current_node.speaker, _current_node.text, labels)
