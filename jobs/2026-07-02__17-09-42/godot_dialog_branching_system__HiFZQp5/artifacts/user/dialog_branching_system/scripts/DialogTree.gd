extends Resource
class_name DialogTree

@export var nodes: Array[DialogNode] = []
@export var start_id: StringName

func get_node(id: StringName) -> DialogNode:
	for n in nodes:
		if n.id == id:
			return n
	return null
