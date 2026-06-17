class_name SaveManager
extends RefCounted

func save_to_disk(data: GameSaveData, path: String, binary: bool) -> int:
	var ext = ".res" if binary else ".tres"
	var final_path = path.get_basename() + ext
	return ResourceSaver.save(data, final_path)

func load_from_disk(path: String) -> GameSaveData:
	var base_path = path.get_basename()
	var provided_ext = path.get_extension()
	
	var exact_path = ""
	if provided_ext == "res" or provided_ext == "tres":
		exact_path = path
		
	if exact_path != "" and FileAccess.file_exists(exact_path):
		return ResourceLoader.load(exact_path) as GameSaveData
		
	if FileAccess.file_exists(base_path + ".res") and FileAccess.file_exists(base_path + ".tres"):
		if provided_ext == "res":
			return ResourceLoader.load(base_path + ".res") as GameSaveData
		elif provided_ext == "tres":
			return ResourceLoader.load(base_path + ".tres") as GameSaveData
		else:
			return ResourceLoader.load(base_path + ".tres") as GameSaveData
			
	if FileAccess.file_exists(base_path + ".res"):
		return ResourceLoader.load(base_path + ".res") as GameSaveData
	elif FileAccess.file_exists(base_path + ".tres"):
		return ResourceLoader.load(base_path + ".tres") as GameSaveData
		
	return null

func compute_hash(data: GameSaveData) -> String:
	var ctx = HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	
	var s = ""
	s += "pos:" + str(data.player_position.x) + "," + str(data.player_position.y) + "|"
	s += "lp:" + str(data.last_played) + "|"
	s += "lvls:"
	for lvl in data.unlocked_levels:
		s += lvl + ","
	s += "|"
	s += "inv:"
	for item in data.inventory:
		if item != null:
			s += item.id + "," + str(item.quantity) + "," + str(item.rarity) + "|"
		else:
			s += "null|"
			
	ctx.update(s.to_utf8_buffer())
	return ctx.finish().hex_encode()
