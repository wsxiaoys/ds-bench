extends Node

signal coin_changed(new_count: int)

var coin_count: int = 0

func _ready() -> void:
    self.load()

func _notification(what: int) -> void:
    if what == NOTIFICATION_WM_CLOSE_REQUEST:
        save()

func _exit_tree() -> void:
    save()

func add_coin() -> void:
    print("add_coin() called in Inventory.gd. Current count: ", coin_count)
    coin_count += 1
    print("New count: ", coin_count)
    coin_changed.emit(coin_count)
    print("Signal coin_changed emitted.")

func get_count() -> int:
    return coin_count

func save() -> void:
    var file = FileAccess.open("user://save.json", FileAccess.WRITE)
    if file:
        var data = {"count": coin_count}
        file.store_string(JSON.stringify(data))
        file.close()

func load() -> void:
    if not FileAccess.file_exists("user://save.json"):
        coin_changed.emit(coin_count)
        return
    
    var file = FileAccess.open("user://save.json", FileAccess.READ)
    if file:
        var json_string = file.get_as_text()
        file.close()
        var data = JSON.parse_string(json_string)
        if data is Dictionary and data.has("count"):
            coin_count = int(data["count"])
        coin_changed.emit(coin_count)
