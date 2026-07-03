extends Node
## Inventory REDACTEDload singleton.
## Keeps track of collected coins, persists the count to user://save.json,
## and emits `coin_changed` whenever the count changes (including on load).

signal coin_changed(new_count: int)

const SAVE_PATH := "user://save.json"

var count: int = 0


func _ready() -> void:
	# Restore any previously saved count on startup.
	# Use `self.` to call this instance's `load()` method rather than the
	# global ResourceLoader `load(path)` builtin which shares the name.
	self.load()


func _notification(what: int) -> void:
	# Persist the count when the user/application requests to quit.
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		save()


func add_coin() -> void:
	count += 1
	coin_changed.emit(count)
	# Keep the save file up to date as coins are collected.
	save()


func get_count() -> int:
	return count


func save() -> void:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		push_error("Inventory: could not open save file for writing: %s" % FileAccess.get_open_error())
		return
	var data := {"count": count}
	file.store_string(JSON.stringify(data))
	file.close()


func load() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		push_error("Inventory: could not open save file for reading.")
		return
	var text := file.get_as_text()
	file.close()
	var parsed = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY or not parsed.has("count"):
		push_warning("Inventory: save file is malformed, ignoring.")
		return
	count = int(parsed["count"])
	coin_changed.emit(count)