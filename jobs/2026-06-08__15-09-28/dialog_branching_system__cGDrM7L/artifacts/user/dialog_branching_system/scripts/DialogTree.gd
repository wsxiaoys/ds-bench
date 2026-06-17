## Container resource that holds all DialogNodes for a conversation.
## start_id identifies which node begins playback.
@tool
class_name DialogTree
extends Resource

const DialogNodeScript := preload("res://scripts/DialogNode.gd")

@export var nodes: Array[DialogNodeScript] = []
@export var start_id: StringName = &""

## Returns the DialogNode whose id matches the given id, or null if not found.
func get_node(id: StringName) -> DialogNodeScript:
	for node in nodes:
		if node.id == id:
			return node
	return null
