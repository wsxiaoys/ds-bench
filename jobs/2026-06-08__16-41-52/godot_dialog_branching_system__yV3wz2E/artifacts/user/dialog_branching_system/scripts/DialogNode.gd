extends Resource
class_name DialogNode

const DialogChoice = preload("res://scripts/DialogChoice.gd")

@export var id: StringName = &""
@export var speaker: String = ""
@export var text: String = ""
@export var choices: Array[DialogChoice] = []
@export var next_id: StringName = &""
