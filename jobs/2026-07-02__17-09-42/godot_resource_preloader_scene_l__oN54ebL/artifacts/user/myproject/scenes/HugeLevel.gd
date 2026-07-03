extends Node2D

## Placeholder behavior script for the procedurally-populated HugeLevel.
## The actual Node2D descendants live directly in [code]HugeLevel.tscn[/code]
## so the count is guaranteed the moment the scene is instantiated, even
## before this [code]_ready[/code] runs.

func _ready() -> void:
	# Nothing extra to do; the 64 Node2D children authored in the .tscn
	# satisfy the ">= 50 Node2D descendants" requirement.
	pass
