extends RefCounted
class_name SaveManager


func save_to_disk(data: GameSaveData, path: String, binary: bool) -> int:
	var normalized_path := _normalize_save_path(path, binary)
	return ResourceSaver.save(data, normalized_path)


func load_from_disk(path: String) -> GameSaveData:
	var load_path := _resolve_load_path(path)
	if load_path == "" or not FileAccess.file_exists(load_path):
		return null
	var resource = ResourceLoader.load(load_path)
	if resource is GameSaveData:
		return resource
	return null


func compute_hash(data: GameSaveData) -> String:
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)

	# Hash player_position
	ctx.update(var_to_bytes(data.player_position))

	# Hash each inventory item's exported fields in order
	for item: ItemData in data.inventory:
		ctx.update(var_to_bytes(item.id))
		ctx.update(var_to_bytes(item.quantity))
		ctx.update(var_to_bytes(item.rarity))

	# Hash unlocked_levels
	ctx.update(var_to_bytes(data.unlocked_levels))

	# Hash last_played
	ctx.update(var_to_bytes(data.last_played))

	return ctx.finish().hex_encode().to_lower()


func _normalize_save_path(path: String, binary: bool) -> String:
	var ext := ".res" if binary else ".tres"
	if path.ends_with(".tres") or path.ends_with(".res"):
		return path.get_basename() + ext
	else:
		return path + ext


func _resolve_load_path(path: String) -> String:
	if path.ends_with(".tres"):
		# Prefer exact extension match, fall back to alternate
		if FileAccess.file_exists(path):
			return path
		var alt_path := path.get_basename() + ".res"
		if FileAccess.file_exists(alt_path):
			return alt_path
		return path
	elif path.ends_with(".res"):
		# Prefer exact extension match, fall back to alternate
		if FileAccess.file_exists(path):
			return path
		var alt_path := path.get_basename() + ".tres"
		if FileAccess.file_exists(alt_path):
			return alt_path
		return path
	else:
		# No extension provided — check both formats
		var tres_path := path + ".tres"
		var res_path := path + ".res"
		if FileAccess.file_exists(tres_path):
			return tres_path
		if FileAccess.file_exists(res_path):
			return res_path
		# Default to text format if neither exists yet
		return tres_path