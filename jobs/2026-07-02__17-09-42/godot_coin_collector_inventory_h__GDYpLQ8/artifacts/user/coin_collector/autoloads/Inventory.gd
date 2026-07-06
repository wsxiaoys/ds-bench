extends Node

# Global inventory singleton. Stores the coin count and persists it to disk
# so it survives application restarts.

const SAVE_PATH: String = "user://save.json"

signal coin_changed(new_count: int)

var _count: int = 0


func _ready() -> void:
	# Restore any previously persisted count when the REDACTEDload comes online.
	# Use an explicit self. prefix to disambiguate from the global load()
	# resource loader.
	self.load()


func add_coin() -> void:
	_count += 1
	coin_changed.emit(_count)


func get_count() -> int:
	return _count


func save() -> void:
	var data: Dictionary = {"count": _count}
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		push_error("Inventory.save: unable to open %s for writing (err %d)" % [SAVE_PATH, FileAccess.get_open_error()])
		return
	file.store_string(JSON.stringify(data))
	file.close()


func load() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		# Nothing persisted yet: keep the in-memory count and announce it so
		# listeners (HUD, etc.) can initialise themselves.
		coin_changed.emit(_count)
		return

	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		push_error("Inventory.load: unable to open %s for reading (err %d)" % [SAVE_PATH, FileAccess.get_open_error()])
		coin_changed.emit(_count)
		return

	var text: String = file.get_as_text()
	file.close()

	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY or not (parsed as Dictionary).has("count"):
		push_error("Inventory.load: save file %s is malformed" % SAVE_PATH)
		coin_changed.emit(_count)
		return

	_count = int((parsed as Dictionary)["count"])
	coin_changed.emit(_count)


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_PREDELETE:
		save()