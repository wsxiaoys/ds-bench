extends Resource
class_name DialogTree

@export var nodes: Array[DialogNode] = []
@export var start_id: StringName = &""

func get_node(id: StringName) -> DialogNode:
	for node in nodes:
		if node and node.id == id:
			return node
	return null
