## A single selectable choice within a DialogNode.
## condition_flag: if non-empty, this choice is only shown when that flag is set.
@tool
class_name DialogChoice
extends Resource

@export var label: String = ""
@export var next_id: StringName = &""
@export var condition_flag: StringName = &""
