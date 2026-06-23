extends Node
class_name DialogPlayer

signal line_shown(speaker: String, text: String, choices_labels: Array)
signal dialog_finished()

@export var tree: DialogTree

var current_node: DialogNode
var flags: Dictionary = {}
var visible_choices: Array[DialogChoice] = []

func start() -> void:
	if not tree:
		return
	var node = tree.get_node(tree.start_id)
	if node:
		_play_node(node)
	else:
		emit_signal("dialog_finished")

func advance(choice_index: int = -1) -> void:
	if not current_node:
		return
		
	var next_id: StringName = ""
	
	if current_node.choices.size() > 0:
		if choice_index >= 0 and choice_index < visible_choices.size():
			next_id = visible_choices[choice_index].next_id
		else:
			return # Invalid choice
	else:
		next_id = current_node.next_id
		
	if next_id == "":
		current_node = null
		emit_signal("dialog_finished")
		return
		
	var node = tree.get_node(next_id)
	if node:
		_play_node(node)
	else:
		current_node = null
		emit_signal("dialog_finished")

func _play_node(node: DialogNode) -> void:
	current_node = node
	visible_choices.clear()
	var labels = []
	
	for choice in node.choices:
		if choice == null:
			continue
		if choice.condition_flag == "" or has_flag(choice.condition_flag):
			visible_choices.append(choice)
			labels.append(choice.label)
			
	emit_signal("line_shown", node.speaker, node.text, labels)

func set_flag(name: StringName) -> void:
	flags[name] = true

func has_flag(name: StringName) -> bool:
	return flags.has(name) and flags[name]
