class_name SaveManager
extends RefCounted

## Stateless helper for persisting [GameSaveData] to disk and computing
## a deterministic hash of its contents.
##
## This is intentionally *not* a [Resource] subclass: it is a plain
## utility object that wraps [ResourceSaver] / [ResourceLoader] and adds
## extension normalisation plus a stable hash.  Use it from any node
## or [RefCounted] context, e.g.
## [codeblock]
## var sm := SaveManager.new()
## sm.save_to_disk(data, "user://save", false)  # writes save.tres
## [/codeblock]

const _EXT_TEXT: String = ".tres"
const _EXT_BINARY: String = ".res"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

## Persist [param data] to disk at [param path], rewriting the extension
## to match the requested format.
##
## [param path] may be supplied with or without a [code].tres[/code] /
## [code].res[/code] extension; any existing extension is stripped and
## replaced with the correct one for the chosen format.
##
## Returns [constant @GlobalScope.OK] ([code]0[/code]) on success or the
## [enum Error] code returned by [method ResourceSaver.save].
func save_to_disk(data: GameSaveData, path: String, binary: bool) -> int:
	var target_ext: String = _EXT_BINARY if binary else _EXT_TEXT
	var final_path: String = _normalize_save_path(path, target_ext)

	# Make sure the parent directory exists so that user://sub/dir/foo.tres
	# works even when "sub/dir" has not been created yet.
	var parent_dir: String = final_path.get_base_dir()
	if not parent_dir.is_empty() and not DirAccess.dir_exists_absolute(parent_dir):
		var mkdir_err: int = DirAccess.make_dir_recursive_absolute(parent_dir)
		if mkdir_err != OK:
			return mkdir_err

	return ResourceSaver.save(data, final_path)


## Load a [GameSaveData] from [param path].
##
## [param path] may be supplied with or without an extension.  When the
## caller already provided a [code].tres[/code] / [code].res[/code]
## extension that exact file is tried first; if it does not exist the
## other extension is attempted.  When the caller provided no extension
## [code].tres[/code] is tried first, then [code].res[/code].
##
## Returns the loaded [GameSaveData] or [code]null[/code] if no matching
## file could be found or loaded.
func load_from_disk(path: String) -> GameSaveData:
	for candidate in _candidate_load_paths(path):
		if not FileAccess.file_exists(candidate):
			continue
		var loaded: Resource = ResourceLoader.load(candidate)
		if loaded != null:
			return loaded
	return null


## Compute a deterministic lowercase hex SHA-256 digest of [param data].
##
## The hash is computed over a canonical, length-prefixed encoding of
## every exported field, including the order and full contents of every
## nested [ItemData] in [member GameSaveData.inventory] and every entry
## in [member GameSaveData.unlocked_levels].  Two [GameSaveData]
## instances with identical field values (and identical item order)
## produce identical hashes; any difference in any field, item order,
## or item value yields a different hash.
func compute_hash(data: GameSaveData) -> String:
	var ctx: HashingContext = HashingContext.new()
	var start_err: int = ctx.start(HashingContext.HASH_SHA256)
	assert(start_err == OK, "HashingContext failed to start for SHA-256")

	# Domain separator / type tag so a GameSaveData hash can never
	# accidentally collide with a hash of, say, raw bytes.
	_update_string(ctx, "GameSaveData")
	_update_string(ctx, "v1")

	# player_position: Vector2
	_update_float(ctx, data.player_position.x)
	_update_float(ctx, data.player_position.y)

	# inventory: Array[ItemData]
	_update_int(ctx, data.inventory.size())
	for item in data.inventory:
		_update_string(ctx, "ItemData")
		_update_string(ctx, item.id)
		_update_int(ctx, item.quantity)
		_update_int(ctx, item.rarity)

	# unlocked_levels: PackedStringArray
	_update_int(ctx, data.unlocked_levels.size())
	for level in data.unlocked_levels:
		_update_string(ctx, level)

	# last_played: int
	_update_int(ctx, data.last_played)

	var digest: PackedByteArray = ctx.finish()
	return digest.hex_encode()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

## Strip any existing extension from [param path] and append
## [param target_ext].
func _normalize_save_path(path: String, target_ext: String) -> String:
	return path.get_basename() + target_ext


## Return the list of paths to try when loading, in priority order.
## The first existing file wins.
func _candidate_load_paths(path: String) -> PackedStringArray:
	var out: PackedStringArray = PackedStringArray()
	if path.ends_with(_EXT_TEXT) or path.ends_with(_EXT_BINARY):
		# Caller-supplied extension takes priority.
		out.append(path)
		var other_ext: String = _EXT_BINARY if path.ends_with(_EXT_TEXT) else _EXT_TEXT
		out.append(path.get_basename() + other_ext)
	else:
		# No extension: try text first, then binary.
		out.append(path + _EXT_TEXT)
		out.append(path + _EXT_BINARY)
	return out


# Length-prefixed byte helpers keep the canonical encoding collision-free
# even if an item id or level name contains characters that overlap with
# whatever separator we might pick.

func _update_string(ctx: HashingContext, s: String) -> void:
	# Encode string length as a fixed-width signed 64-bit integer so the
	# boundary between adjacent strings can never be ambiguous.
	_update_int(ctx, s.length())
	ctx.update(s.to_utf8_buffer())


func _update_int(ctx: HashingContext, n: int) -> void:
	var bytes: PackedByteArray = PackedByteArray()
	bytes.resize(8)
	bytes.encode_s64(0, n)
	ctx.update(bytes)


func _update_float(ctx: HashingContext, f: float) -> void:
	var bytes: PackedByteArray = PackedByteArray()
	bytes.resize(8)
	bytes.encode_double(0, f)
	ctx.update(bytes)
