extends RefCounted
class_name SaveManager

static func _normalize_path(path: String, binary: bool) -> String:
	var ext := ".res" if binary else ".tres"
	var lower_path := path.to_lower()
	if lower_path.ends_with(".res"):
		return path.left(-4) + ext
	elif lower_path.ends_with(".tres"):
		return path.left(-5) + ext
	else:
		return path + ext

static func save_to_disk(data: GameSaveData, path: String, binary: bool) -> int:
	if data == null:
		return ERR_INVALID_PARAMETER
	
	var target_path := _normalize_path(path, binary)
	
	var dir := target_path.get_base_dir()
	if dir != "" and not DirAccess.dir_exists_absolute(dir):
		var err := DirAccess.make_dir_recursive_absolute(dir)
		if err != OK:
			return err
			
	return ResourceSaver.save(data, target_path)

static func load_from_disk(path: String) -> GameSaveData:
	var lower_path := path.to_lower()
	var resolved_path := ""
	
	if lower_path.ends_with(".res"):
		if FileAccess.file_exists(path):
			resolved_path = path
		else:
			var alternative := path.left(-4) + ".tres"
			if FileAccess.file_exists(alternative):
				resolved_path = alternative
	elif lower_path.ends_with(".tres"):
		if FileAccess.file_exists(path):
			resolved_path = path
		else:
			var alternative := path.left(-5) + ".res"
			if FileAccess.file_exists(alternative):
				resolved_path = alternative
	else:
		var path_tres := path + ".tres"
		var path_res := path + ".res"
		if FileAccess.file_exists(path_tres):
			resolved_path = path_tres
		elif FileAccess.file_exists(path_res):
			resolved_path = path_res
			
	if resolved_path == "" or not FileAccess.file_exists(resolved_path):
		return null
		
	var loaded = ResourceLoader.load(resolved_path, "", ResourceLoader.CACHE_MODE_REPLACE)
	return loaded as GameSaveData

static func compute_hash(data: GameSaveData) -> String:
	if data == null:
		return ""
		
	var parts := []
	parts.append("player_position:%.6f,%.6f" % [data.player_position.x, data.player_position.y])
	parts.append("last_played:%d" % data.last_played)
	
	parts.append("unlocked_levels_size:%d" % data.unlocked_levels.size())
	for lvl in data.unlocked_levels:
		parts.append("level:%s" % lvl)
		
	parts.append("inventory_size:%d" % data.inventory.size())
	for item in data.inventory:
		if item == null:
			parts.append("item:null")
		else:
			parts.append("item:%s,%d,%d" % [item.id, item.quantity, item.rarity])
			
	var full_string := "|".join(parts)
	var bytes := full_string.to_utf8_buffer()
	
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	ctx.update(bytes)
	var hash_bytes := ctx.finish()
	return hash_bytes.hex_encode().to_lower()
