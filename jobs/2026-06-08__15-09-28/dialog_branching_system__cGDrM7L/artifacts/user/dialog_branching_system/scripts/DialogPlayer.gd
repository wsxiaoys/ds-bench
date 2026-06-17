## Runtime controller for a DialogTree.
## Attach this node to the scene, assign a DialogTree resource to `tree`,
## then call start() to begin playback.
class_name DialogPlayer
extends Node

const DialogTreeScript   := preload("res://scripts/DialogTree.gd")
const DialogNodeScript   := preload("res://scripts/DialogNode.gd")
const DialogChoiceScript := preload("res://scripts/DialogChoice.gd")

## The dialog tree to play through.
@export var tree: DialogTreeScript

## Emitted whenever a new node is presented.
## choices_labels contains only the labels of currently visible choices
## (choices whose condition_flag is set, or whose condition_flag is empty).
signal line_shown(speaker: String, text: String, choices_labels: Array)

## Emitted when the dialog reaches a terminal node (no choices, no next_id).
signal dialog_finished

# ── private state ──────────────────────────────────────────────────────────────

var _current_node: DialogNodeScript = null
var _flags: Dictionary = {}  # StringName -> true


# ── public API ─────────────────────────────────────────────────────────────────

## Begin playback at tree.start_id. Emits line_shown for the first node.
func start() -> void:
	assert(tree != null, "DialogPlayer: tree must be assigned before calling start()")
	_flags.clear()
	_go_to(tree.start_id)


## Advance the dialog.
##   - If the current node has visible choices, choice_index selects one.
##   - If the current node has no choices, follows next_id (choice_index ignored).
##   - If both choices and next_id are empty, emits dialog_finished.
func advance(choice_index: int = -1) -> void:
	if _current_node == null:
		push_warning("DialogPlayer.advance() called before start()")
		return

	var visible := _visible_choices(_current_node)

	if visible.size() > 0:
		# Choices available – pick one.
		if choice_index < 0 or choice_index >= visible.size():
			push_error("DialogPlayer.advance(): choice_index %d out of range (visible choices: %d)" \
					% [choice_index, visible.size()])
			return
		_go_to(visible[choice_index].next_id)
	elif _current_node.next_id != &"":
		_go_to(_current_node.next_id)
	else:
		_current_node = null
		dialog_finished.emit()


## Mark a flag as set. Used to unlock condition_flag-gated choices.
func set_flag(name: StringName) -> void:
	_flags[name] = true


## Returns true when the named flag has been set via set_flag().
func has_flag(name: StringName) -> bool:
	return _flags.has(name)


## Clear a previously set flag.
func clear_flag(name: StringName) -> void:
	_flags.erase(name)


# ── private helpers ────────────────────────────────────────────────────────────

func _go_to(id: StringName) -> void:
	var node: DialogNodeScript = tree.get_node(id)
	if node == null:
		push_error("DialogPlayer: no DialogNode with id '%s'" % id)
		dialog_finished.emit()
		return
	_current_node = node
	var labels: Array = []
	for choice in _visible_choices(node):
		labels.append(choice.label)
	line_shown.emit(node.speaker, node.text, labels)


func _visible_choices(node: DialogNodeScript) -> Array:
	var result: Array = []
	for choice in node.choices:
		if choice.condition_flag == &"" or has_flag(choice.condition_flag):
			result.append(choice)
	return result
