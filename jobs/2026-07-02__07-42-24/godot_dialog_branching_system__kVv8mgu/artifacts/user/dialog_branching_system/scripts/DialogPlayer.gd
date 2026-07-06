extends Node
class_name DialogPlayer

signal line_shown(speaker: String, text: String, choices_labels: Array)
signal dialog_finished

@export var tree: DialogTree

var current_node: DialogNode = null
var _flags: Dictionary = {}

func start() -> void:
	if not tree:
		emit_signal("dialog_finished")
		return
	_goto_node(tree.start_id)

func advance(choice_index: int = -1) -> void:
	if not current_node:
		emit_signal("dialog_finished")
		return

	if not current_node.choices.is_empty():
		var visible_choices = _get_visible_choices(current_node)
		if choice_index >= 0 and choice_index < visible_choices.size():
			var chosen = visible_choices[choice_index]
			_goto_node(chosen.next_id)
		else:
			# If there are choices but index is invalid, do nothing (wait for valid choice)
			return
	else:
		if current_node.next_id == &"":
			current_node = null
			emit_signal("dialog_finished")
		else:
			_goto_node(current_node.next_id)

func set_flag(name: StringName) -> void:
	_flags[name] = true

func has_flag(name: StringName) -> bool:
	return _flags.get(name, false)

func _get_visible_choices(node: DialogNode) -> Array[DialogChoice]:
	var visible_choices: Array[DialogChoice] = []
	for choice in node.choices:
		if choice:
			if choice.condition_flag == &"" or has_flag(choice.condition_flag):
				visible_choices.append(choice)
	return visible_choices

func _goto_node(node_id: StringName) -> void:
	if not tree:
		current_node = null
		emit_signal("dialog_finished")
		return
	
	var next_node = tree.get_node(node_id)
	if next_node:
		current_node = next_node
		_show_current_node()
	else:
		current_node = null
		emit_signal("dialog_finished")

func _show_current_node() -> void:
	if not current_node:
		emit_signal("dialog_finished")
		return
	
	var visible_choices = _get_visible_choices(current_node)
	var choice_labels: Array = []
	for choice in visible_choices:
		choice_labels.append(choice.label)
	
	emit_signal("line_shown", current_node.speaker, current_node.text, choice_labels)
