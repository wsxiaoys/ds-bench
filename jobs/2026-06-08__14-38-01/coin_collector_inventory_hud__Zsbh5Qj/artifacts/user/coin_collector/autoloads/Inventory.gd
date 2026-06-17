extends Node

signal coin_changed(new_count: int)

var count: int = 0

func _ready() -> void:
	self.load()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_PREDELETE:
		save()

func add_coin() -> void:
	count += 1
	coin_changed.emit(count)

func get_count() -> int:
	return count

func save() -> void:
	var file = FileAccess.open("user://save.json", FileAccess.WRITE)
	if file:
		var data = {
			"count": count
		}
		var json_string = JSON.stringify(data)
		file.store_string(json_string)
		file.close()

func load() -> void:
	if FileAccess.file_exists("user://save.json"):
		var file = FileAccess.open("user://save.json", FileAccess.READ)
		if file:
			var json_string = file.get_as_text()
			file.close()
			var data = JSON.parse_string(json_string)
			if data is Dictionary and data.has("count"):
				count = int(data["count"])
	coin_changed.emit(count)
