extends Node

signal progress_updated(fraction)
signal load_completed(scene)
signal load_failed(reason)

func start_load(path: String) -> bool:
	return false

func cancel() -> void:
	pass

func is_loading() -> bool:
	return false