extends Node
class_name SaveManager

const _EXT_TRES := ".tres"
const _EXT_RES := ".res"

func save_to_disk(data: GameSaveData, path: String, binary: bool) -> int:
	var target_ext: String = _EXT_RES if binary else _EXT_TRES
	var normalized_path: String = _normalize_save_path(path, target_ext)
	var err: int = ResourceSaver.save(data, normalized_path)
	return err

func load_from_disk(path: String) -> GameSaveData:
	var resolved_path: String = _resolve_load_path(path)
	var res: Resource = ResourceLoader.load(resolved_path, "", ResourceLoader.CACHE_MODE_IGNORE)
	if res == null:
		return null
	return res as GameSaveData

func compute_hash(data: GameSaveData) -> String:
	var ctx: HashingContext = HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	_hash_field(ctx, str(data.player_position.x))
	_hash_field(ctx, str(data.player_position.y))
	_hash_field(ctx, str(data.inventory.size()))
	for item in data.inventory:
		_hash_field(ctx, str(item.id))
		_hash_field(ctx, str(item.quantity))
		_hash_field(ctx, str(item.rarity))
	_hash_field(ctx, str(data.unlocked_levels.size()))
	for lvl in data.unlocked_levels:
		_hash_field(ctx, str(lvl))
	_hash_field(ctx, str(data.last_played))
	return ctx.finish().hex_encode().to_lower()

func _hash_field(ctx: HashingContext, value: String) -> void:
	ctx.update(value.to_utf8_buffer())
	ctx.update("|".to_utf8_buffer())

func _normalize_save_path(path: String, target_ext: String) -> String:
	var p: String = path
	if p.ends_with(_EXT_TRES) or p.ends_with(_EXT_RES):
		p = p.get_basename()
	return p + target_ext

func _resolve_load_path(path: String) -> String:
	if path.ends_with(_EXT_TRES):
		if FileAccess.file_exists(path):
			return path
		var res_path: String = path.get_basename() + _EXT_RES
		if FileAccess.file_exists(res_path):
			return res_path
		return path
	if path.ends_with(_EXT_RES):
		if FileAccess.file_exists(path):
			return path
		var tres_path: String = path.get_basename() + _EXT_TRES
		if FileAccess.file_exists(tres_path):
			return tres_path
		return path
	var candidate_res: String = path + _EXT_RES
	if FileAccess.file_exists(candidate_res):
		return candidate_res
	var candidate_tres: String = path + _EXT_TRES
	if FileAccess.file_exists(candidate_tres):
		return candidate_tres
	return path
