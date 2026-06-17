extends Node

signal coin_changed(new_count: int)

const SAVE_PATH := "user://save.json"

var _count: int = 0


func _ready() -> void:
	self.load()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		self.save()


func add_coin() -> void:
	_count += 1
	emit_signal("coin_changed", _count)


func get_count() -> int:
	return _count


func save() -> void:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify({"count": _count}))
		file.close()


func load() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file:
		var text := file.get_as_text()
		file.close()
		var parsed = JSON.parse_string(text)
		if parsed is Dictionary and parsed.has("count"):
			_count = int(parsed["count"])
			emit_signal("coin_changed", _count)
