class_name SaveManager
extends RefCounted

## Handles serialization of [GameSaveData] (with nested [ItemData] sub-resources)
## to and from disk in both the human-readable ``.tres`` and compact binary
## ``.res`` formats, plus a deterministic SHA-256 digest for integrity checks.

const _EXT_TEXT: String = ".tres"
const _EXT_BINARY: String = ".res"


## Saves [param data] to [param path].
## [param path] may be supplied with or without a file extension; it is
## normalized so that the on-disk extension is ``.res`` when [param binary]
## is [code]true[/code] and ``.tres`` otherwise. Returns [constant OK] on
## success or the error code produced by [ResourceSaver].
func save_to_disk(data: GameSaveData, path: String, binary: bool) -> int:
	var target_ext: String = _EXT_BINARY if binary else _EXT_TEXT
	var full_path: String = _normalize_extension(path, target_ext)
	return ResourceSaver.save(data, full_path)


## Loads a [GameSaveData] from [param path].
## Accepts the same input forms as [method save_to_disk] (with or without an
## extension) and resolves to whichever of ``<path>.tres`` / ``<path>.res``
## exists on disk, preferring an exact extension match when the caller already
## supplied one. Returns [code]null[/code] if no candidate file is found.
func load_from_disk(path: String) -> GameSaveData:
	for candidate in _load_candidates(path):
		if FileAccess.file_exists(candidate):
			var loaded: Resource = ResourceLoader.load(candidate)
			if loaded is GameSaveData:
				return loaded as GameSaveData
			return null
	return null


## Returns a deterministic lowercase hex SHA-256 digest derived from the
## [GameSaveData] fields and every nested [ItemData]'s fields. Two instances
## with identical field values (including item order) produce identical
## digests; differing values produce different digests.
func compute_hash(data: GameSaveData) -> String:
	var ctx: HashingContext = HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	var payload: String = _serialize_for_hash(data)
	ctx.update(payload.to_utf8_buffer())
	var digest: PackedByteArray = ctx.finish()
	return digest.hex_encode().to_lower()


# --- internals ---------------------------------------------------------------

## Strips any existing ``.tres``/``.res`` extension from [param path] and
## appends [param target_ext]. Paths supplied without an extension are left
## untouched (apart from the appended extension).
static func _normalize_extension(path: String, target_ext: String) -> String:
	if path.ends_with(_EXT_TEXT) or path.ends_with(_EXT_BINARY):
		return path.get_basename() + target_ext
	return path + target_ext


## Builds the ordered list of candidate file paths to probe when loading.
## An exact extension match (when the caller supplied one) is tried first.
static func _load_candidates(path: String) -> Array[String]:
	var candidates: Array[String] = []
	if path.ends_with(_EXT_TEXT):
		var base: String = path.get_basename()
		candidates.append(base + _EXT_TEXT)
		candidates.append(base + _EXT_BINARY)
	elif path.ends_with(_EXT_BINARY):
		var base: String = path.get_basename()
		candidates.append(base + _EXT_BINARY)
		candidates.append(base + _EXT_TEXT)
	else:
		candidates.append(path + _EXT_TEXT)
		candidates.append(path + _EXT_BINARY)
	return candidates


## Serializes the [GameSaveData] (and all nested [ItemData] entries, in order)
## into a stable string representation suitable for hashing. Delimiters are
## chosen so that distinct field values cannot collide.
static func _serialize_for_hash(data: GameSaveData) -> String:
	var parts: PackedStringArray = PackedStringArray()
	parts.append("player_position=" + str(data.player_position))
	parts.append("last_played=" + str(data.last_played))

	var item_parts: PackedStringArray = PackedStringArray()
	for item in data.inventory:
		item_parts.append(
			"{id=%s,quantity=%d,rarity=%d}" % [str(item.id), int(item.quantity), int(item.rarity)]
		)
	parts.append("inventory=[" + ",".join(item_parts) + "]")

	parts.append("unlocked_levels=[" + ",".join(data.unlocked_levels) + "]")
	return "|".join(parts)