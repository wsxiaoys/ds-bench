extends Resource
class_name DialogTree

const DialogNode = preload("res://scripts/DialogNode.gd")

@export var nodes: Array[DialogNode] = []
@export var start_id: StringName = &""

func get_node(id: StringName) -> DialogNode:
	for node in nodes:
		if node.id == id:
			return node
	return null
