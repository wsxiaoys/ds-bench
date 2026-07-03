extends Node
class_name DialogPlayer

signal line_shown(speaker: String, text: String, choices_labels: Array)
signal dialog_finished

@export var tree: DialogTree

var _flags: Dictionary = {}
var _current_id: StringName = &""
var _active: bool = false

func start() -> void:
	_active = true
	_current_id = tree.start_id
	_show_current()

func advance(choice_index: int = -1) -> void:
	if not _active:
		return
	var node: DialogNode = tree.get_node(_current_id)
	if node == null:
		return
	var visible_choices: Array = _get_visible_choices(node)
	if visible_choices.size() > 0:
		if choice_index < 0 or choice_index >= visible_choices.size():
			return
		_current_id = visible_choices[choice_index].next_id
	else:
		_current_id = node.next_id
	if _current_id == StringName(""):
		_active = false
		dialog_finished.emit()
		return
	_show_current()

func set_flag(name: StringName) -> void:
	_flags[name] = true

func has_flag(name: StringName) -> bool:
	return _flags.get(name, false)

func _get_visible_choices(node: DialogNode) -> Array:
	var visible: Array = []
	for c in node.choices:
		var flag: StringName = c.condition_flag
		if flag == StringName(""):
			visible.append(c)
		elif has_flag(flag):
			visible.append(c)
	return visible

func _show_current() -> void:
	var node: DialogNode = tree.get_node(_current_id)
	if node == null:
		_active = false
		dialog_finished.emit()
		return
	var visible_choices: Array = _get_visible_choices(node)
	var labels: Array = []
	for c in visible_choices:
		labels.append(c.label)
	line_shown.emit(node.speaker, node.text, labels)
