# scripts/SaveManager.gd
extends RefCounted
class_name SaveManager

## Saves `data` to `path`.
## When `binary == true` the file extension on disk must be `.res`; when `binary == false` it must be `.tres`.
## The method must accept a path with or without an extension, normalize it to the correct extension, and return `OK` (`0`) on success.
func save_to_disk(data: GameSaveData, path: String, binary: bool) -> int:
	var ext = path.get_extension()
	var base_path = path
	if ext != "":
		base_path = path.left(-ext.length() - 1)
	if path.ends_with("."):
		base_path = path.left(-1)
	
	var final_path = base_path + (".res" if binary else ".tres")
	
	var err = ResourceSaver.save(data, final_path)
	return err

## Loads a `GameSaveData` from the file at `path`.
## The method must accept the same input forms as `save_to_disk` (with or without extension) and resolve to whichever of `<path>.tres` / `<path>.res` exists, preferring an exact extension match when the caller already provided one.
func load_from_disk(path: String) -> GameSaveData:
	var ext = path.get_extension()
	var base_path = path
	if ext != "":
		base_path = path.left(-ext.length() - 1)
	if path.ends_with("."):
		base_path = path.left(-1)
		ext = ""
	
	var file_to_load = ""
	
	if ext == "tres" or ext == "res":
		if FileAccess.file_exists(path):
			file_to_load = path
		else:
			var other_ext = "res" if ext == "tres" else "tres"
			var other_path = base_path + "." + other_ext
			if FileAccess.file_exists(other_path):
				file_to_load = other_path
	else:
		if ext != "" and FileAccess.file_exists(path):
			file_to_load = path
		else:
			var tres_path = base_path + ".tres"
			var res_path = base_path + ".res"
			if FileAccess.file_exists(tres_path):
				file_to_load = tres_path
			elif FileAccess.file_exists(res_path):
				file_to_load = res_path
	
	if file_to_load == "":
		return null
		
	var loaded = ResourceLoader.load(file_to_load)
	if loaded is GameSaveData:
		return loaded
	return null

## Returns a deterministic lowercase hex SHA-256 digest derived from the `GameSaveData` fields and every nested `ItemData`'s fields.
func compute_hash(data: GameSaveData) -> String:
	if data == null:
		return ""
	
	var lines = []
	lines.append("player_position_x:%.6f" % data.player_position.x)
	lines.append("player_position_y:%.6f" % data.player_position.y)
	lines.append("last_played:%d" % data.last_played)
	
	lines.append("unlocked_levels_size:%d" % data.unlocked_levels.size())
	for level in data.unlocked_levels:
		lines.append("level:%s" % level)
		
	lines.append("inventory_size:%d" % data.inventory.size())
	for item in data.inventory:
		if item == null:
			lines.append("item:null")
		else:
			lines.append("item_id:%s" % item.id)
			lines.append("item_quantity:%d" % item.quantity)
			lines.append("item_rarity:%d" % item.rarity)
			
	var serialized_string = "\n".join(lines)
	var bytes = serialized_string.to_utf8_buffer()
	
	var ctx = HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	ctx.update(bytes)
	var hash_bytes = ctx.finish()
	return hash_bytes.hex_encode().to_lower()
