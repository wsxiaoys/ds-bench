extends Node

signal coin_changed(new_count: int)

var _count: int = 0
var _save_path: String = "user://save.json"

func _ready() -> void:
	load_count()
	get_tree().root.size = Vector2i(640, 480)

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		save_count()

func add_coin() -> void:
	_count += 1
	coin_changed.emit(_count)

func get_count() -> int:
	return _count

func save_count() -> void:
	var file = FileAccess.open(_save_path, FileAccess.WRITE)
	if file:
		var data = {"count": _count}
		file.store_string(JSON.stringify(data))
		file.close()

func load_count() -> void:
	if not FileAccess.file_exists(_save_path):
		return
	var file = FileAccess.open(_save_path, FileAccess.READ)
	if file:
		var content = file.get_as_text()
		file.close()
		var data = JSON.parse_string(content)
		if data != null and data.has("count"):
			_count = int(data["count"])
			coin_changed.emit(_count)
