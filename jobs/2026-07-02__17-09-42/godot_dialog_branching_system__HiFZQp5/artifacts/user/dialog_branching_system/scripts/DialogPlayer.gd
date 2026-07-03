extends Node
class_name DialogPlayer

signal line_shown(speaker: String, text: String, choices_labels: Array)
signal dialog_finished

@export var tree: DialogTree

var _flags: Dictionary = {}
var _current_node: DialogNode = null
var _current_choices: Array[DialogChoice] = []


func start() -> void:
	if tree == null:
		push_error("DialogPlayer: no DialogTree assigned.")
		return
	_go_to(tree.start_id)


func advance(choice_index: int = -1) -> void:
	if _current_node == null:
		return

	if _current_choices.size() > 0:
		if choice_index < 0 or choice_index >= _current_choices.size():
			push_error("DialogPlayer: invalid choice index %d (only %d visible choices)" % [choice_index, _current_choices.size()])
			return
		var next_id: StringName = _current_choices[choice_index].next_id
		_go_to(next_id)
		return

	if _current_node.next_id == StringName(""):
		_current_node = null
		_current_choices = []
		dialog_finished.emit()
		return

	_go_to(_current_node.next_id)


func set_flag(name: StringName) -> void:
	_flags[name] = true


func has_flag(name: StringName) -> bool:
	return bool(_flags.get(name, false))


func _go_to(id: StringName) -> void:
	if tree == null:
		return
	var node: DialogNode = tree.get_node(id)
	if node == null:
		push_error("DialogPlayer: no node with id '%s' in tree." % id)
		_current_node = null
		_current_choices = []
		dialog_finished.emit()
		return

	_current_node = node
	_current_choices = []
	var visible_labels: Array = []
	for choice in node.choices:
		if choice.condition_flag == StringName("") or has_flag(choice.condition_flag):
			_current_choices.append(choice)
			visible_labels.append(choice.label)

	line_shown.emit(node.speaker, node.text, visible_labels)
