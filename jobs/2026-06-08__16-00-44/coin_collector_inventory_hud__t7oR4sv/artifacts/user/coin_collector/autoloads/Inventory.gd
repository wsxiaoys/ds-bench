extends Node

signal coin_changed(new_count: int)

var _count: int = 0

func _ready() -> void:
	self.load()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		self.save()

func add_coin() -> void:
	_count += 1
	coin_changed.emit(_count)

func get_count() -> int:
	return _count

func save() -> void:
	var data := {"count": _count}
	var file := FileAccess.open("user://save.json", FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))
		file.close()

func load() -> void:
	if FileAccess.file_exists("user://save.json"):
		var file := FileAccess.open("user://save.json", FileAccess.READ)
		if file:
			var json_text := file.get_as_text()
			file.close()
			var parsed = JSON.parse_string(json_text)
			if parsed is Dictionary and parsed.has("count"):
				_count = int(parsed["count"])
				coin_changed.emit(_count)
