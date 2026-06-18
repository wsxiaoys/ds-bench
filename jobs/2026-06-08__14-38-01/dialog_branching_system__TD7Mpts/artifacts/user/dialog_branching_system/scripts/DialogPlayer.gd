extends Node
class_name DialogPlayer

signal line_shown(speaker: String, text: String, choices_labels: Array)
signal dialog_finished

@export var tree: DialogTree

var current_node: DialogNode = null
var _flags: Dictionary = {}
var _visible_choices: Array[DialogChoice] = []

func set_flag(name: StringName) -> void:
	_flags[name] = true

func has_flag(name: StringName) -> bool:
	return _flags.get(name, false)

func start() -> void:
	_visible_choices.clear()
	if not tree:
		push_error("DialogPlayer: No DialogTree assigned.")
		emit_signal("dialog_finished")
		return
	
	var node = tree.get_node(tree.start_id)
	if node:
		current_node = node
		_show_current_node()
	else:
		current_node = null
		emit_signal("dialog_finished")

func advance(choice_index: int = -1) -> void:
	if not current_node:
		return
	
	if current_node.choices.is_empty() and current_node.next_id == &"":
		current_node = null
		emit_signal("dialog_finished")
		return
	
	if not current_node.choices.is_empty():
		# Node has choices, we must follow the chosen branch
		if choice_index >= 0 and choice_index < _visible_choices.size():
			var choice = _visible_choices[choice_index]
			var next_node = tree.get_node(choice.next_id)
			if next_node:
				current_node = next_node
				_show_current_node()
			else:
				current_node = null
				emit_signal("dialog_finished")
		else:
			push_error("DialogPlayer: Invalid choice index %d" % choice_index)
	else:
		# Node has no choices, follow next_id
		var next_node = tree.get_node(current_node.next_id)
		if next_node:
			current_node = next_node
			_show_current_node()
		else:
			current_node = null
			emit_signal("dialog_finished")

func _show_current_node() -> void:
	_visible_choices.clear()
	var labels: Array = []
	if current_node:
		for choice in current_node.choices:
			if choice:
				if choice.condition_flag == &"" or has_flag(choice.condition_flag):
					_visible_choices.append(choice)
					labels.append(choice.label)
		emit_signal("line_shown", current_node.speaker, current_node.text, labels)
