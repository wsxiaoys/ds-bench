extends RefCounted
class_name SaveManager

const HASH_SHA256: int = 6

func save_to_disk(data: GameSaveData, path: String, binary: bool) -> int:
	var ext: String = ".res" if binary else ".tres"
	var normalized: String = _normalize_path(path, ext)
	var flags: int = ResourceSaver.FLAG_COMPRESS if binary else 0
	return ResourceSaver.save(data, normalized, flags)


func load_from_disk(path: String) -> GameSaveData:
	var tres_path: String = _normalize_path(path, ".tres")
	var res_path: String = _normalize_path(path, ".res")

	# Prefer exact extension match when the caller already provided one.
	if path.ends_with(".tres"):
		if FileAccess.file_exists(tres_path):
			return ResourceLoader.load(tres_path, "", ResourceLoader.CACHE_MODE_IGNORE) as GameSaveData
		return null
	if path.ends_with(".res"):
		if FileAccess.file_exists(res_path):
			return ResourceLoader.load(res_path, "", ResourceLoader.CACHE_MODE_IGNORE) as GameSaveData
		return null

	# No extension provided – try .tres first, then .res.
	if FileAccess.file_exists(tres_path):
		return ResourceLoader.load(tres_path, "", ResourceLoader.CACHE_MODE_IGNORE) as GameSaveData
	if FileAccess.file_exists(res_path):
		return ResourceLoader.load(res_path, "", ResourceLoader.CACHE_MODE_IGNORE) as GameSaveData
	return null


func compute_hash(data: GameSaveData) -> String:
	var ctx: HashingContext = HashingContext.new()
	ctx.start(HASH_SHA256)

	# Player position — serialize x and y as float strings.
	ctx.update(str(data.player_position.x).to_utf8_buffer())
	ctx.update(str(data.player_position.y).to_utf8_buffer())

	# Inventory — iterate in order for determinism.
	ctx.update(String.num_uint64(data.inventory.size()).to_utf8_buffer())
	for item: ItemData in data.inventory:
		ctx.update(item.id.to_utf8_buffer())
		ctx.update(String.num_int64(item.quantity).to_utf8_buffer())
		ctx.update(String.num_int64(item.rarity).to_utf8_buffer())

	# Unlocked levels.
	ctx.update(String.num_uint64(data.unlocked_levels.size()).to_utf8_buffer())
	for level: String in data.unlocked_levels:
		ctx.update(level.to_utf8_buffer())

	# Last played timestamp.
	ctx.update(String.num_int64(data.last_played).to_utf8_buffer())

	return ctx.finish().hex_encode()


func _normalize_path(path: String, ext: String) -> String:
	if path.ends_with(ext):
		return path
	return path + ext
