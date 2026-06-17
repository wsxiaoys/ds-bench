class_name DialogPlayer
extends Node

signal line_shown(speaker: String, text: String, choices_labels: Array)
signal dialog_finished

@export var tree: DialogTree

var _current_node: DialogNode
var _flags: Dictionary = {}


func start() -> void:
	_flags.clear()
	_current_node = tree.get_node(tree.start_id)
	if _current_node == null:
		push_error("DialogPlayer: start_id '%s' not found in tree" % tree.start_id)
		dialog_finished.emit()
		return
	_emit_current_line()


func advance(choice_index: int = -1) -> void:
	if _current_node == null:
		return

	# Determine next node
	var next_id: StringName = &""

	if _current_node.choices.size() > 0:
		# Collect visible choices to map the index correctly
		var visible_choices: Array[DialogChoice] = []
		for choice in _current_node.choices:
			if choice.condition_flag == &"" or _flags.has(choice.condition_flag):
				visible_choices.append(choice)
		if choice_index < 0 or choice_index >= visible_choices.size():
			push_warning("DialogPlayer: invalid choice_index %d (visible choices: %d)" % [choice_index, visible_choices.size()])
			return
		next_id = visible_choices[choice_index].next_id
	else:
		next_id = _current_node.next_id

	if next_id == &"":
		# End of dialog
		_current_node = null
		dialog_finished.emit()
		return

	_current_node = tree.get_node(next_id)
	if _current_node == null:
		push_error("DialogPlayer: next_id '%s' not found in tree" % next_id)
		_current_node = null
		dialog_finished.emit()
		return

	_emit_current_line()


func set_flag(name: StringName) -> void:
	_flags[name] = true


func has_flag(name: StringName) -> bool:
	return _flags.has(name)


func _emit_current_line() -> void:
	var choices_labels: Array = []
	if _current_node.choices.size() > 0:
		for choice in _current_node.choices:
			if choice.condition_flag == &"" or _flags.has(choice.condition_flag):
				choices_labels.append(choice.label)
	line_shown.emit(_current_node.speaker, _current_node.text, choices_labels)