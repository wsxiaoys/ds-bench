extends Resource
class_name DialogTree

@export var nodes: Array[DialogNode] = []
@export var start_id: StringName = &""

func get_node(node_id: StringName) -> DialogNode:
	for node in nodes:
		if node and node.id == node_id:
			return node
	return null
