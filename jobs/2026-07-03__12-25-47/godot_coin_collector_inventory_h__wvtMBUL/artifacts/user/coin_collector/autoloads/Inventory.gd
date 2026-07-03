extends Node

signal coin_changed(new_count: int)

const SAVE_PATH := "user://save.json"

var _count: int = 0

func _ready() -> void:
	self.load()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_EXIT_TREE:
		self.save()

func add_coin() -> void:
	_count += 1
	coin_changed.emit(_count)

func get_count() -> int:
	return _count

func save() -> void:
	var data := {
		"count": _count,
	}
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify(data))
	file.close()

func load() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		return
	var text := file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	var dict := parsed as Dictionary
	if dict.has("count"):
		_count = int(dict["count"])
		coin_changed.emit(_count)
