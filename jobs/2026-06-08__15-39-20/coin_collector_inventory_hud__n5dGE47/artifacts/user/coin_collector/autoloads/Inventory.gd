extends Node

signal coin_changed(new_count: int)

var count: int = 0
const SAVE_PATH = "user://save.json"

func _ready() -> void:
    self.load()

func _notification(what: int) -> void:
    if what == NOTIFICATION_WM_CLOSE_REQUEST:
        save()

func add_coin() -> void:
    count += 1
    coin_changed.emit(count)

func get_count() -> int:
    return count

func save() -> void:
    var file = FileAccess.open(SAVE_PATH, FileAccess.WRITE)
    if file:
        var data = {"count": count}
        file.store_string(JSON.stringify(data))

func load() -> void:
    if FileAccess.file_exists(SAVE_PATH):
        var file = FileAccess.open(SAVE_PATH, FileAccess.READ)
        if file:
            var content = file.get_as_text()
            var data = JSON.parse_string(content)
            if typeof(data) == TYPE_DICTIONARY and data.has("count"):
                count = int(data["count"])
    coin_changed.emit(count)
