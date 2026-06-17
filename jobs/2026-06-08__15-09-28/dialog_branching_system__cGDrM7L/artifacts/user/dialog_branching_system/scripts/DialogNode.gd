## One node in a dialog tree.
## When choices is empty the dialog automatically advances to next_id.
## When next_id is also empty the dialog ends.
@tool
class_name DialogNode
extends Resource

const DialogChoiceScript := preload("res://scripts/DialogChoice.gd")

@export var id: StringName = &""
@export var speaker: String = ""
@export var text: String = ""
@export var choices: Array[DialogChoiceScript] = []
@export var next_id: StringName = &""
