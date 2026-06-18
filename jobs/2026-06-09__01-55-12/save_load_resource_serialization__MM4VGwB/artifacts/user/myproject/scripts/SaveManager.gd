## SaveManager.gd
## Helper class that saves and loads GameSaveData Resources to/from disk.
##
## Supports both human-readable text format (.tres) and compact binary format
## (.res). The caller may supply a path with or without a file extension; this
## class normalises it to the correct extension before any I/O operation.
##
## Usage (from any script):
##
##   var sm := SaveManager.new()
##   sm.save_to_disk(data, "user://slot1", false)   # writes user://slot1.tres
##   var loaded := sm.load_from_disk("user://slot1") # auto-detects extension
##   print(sm.compute_hash(loaded))
class_name SaveManager
extends RefCounted

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

const _EXT_TEXT   := ".tres"
const _EXT_BINARY := ".res"


## Strip any existing recognised save extension from *path* and return the
## bare stem so we can re-attach the authoritative extension.
func _stem(path: String) -> String:
	if path.ends_with(_EXT_TEXT):
		return path.left(path.length() - _EXT_TEXT.length())
	if path.ends_with(_EXT_BINARY):
		return path.left(path.length() - _EXT_BINARY.length())
	return path


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

## Save *data* to *path*.
##
## When *binary* is ``true`` the file is written as a compact ``.res`` file;
## when ``false`` it is written as a human-readable ``.tres`` file.
## *path* may already carry the correct extension (or the wrong one, or none
## at all) – the method normalises it before writing.
##
## Returns ``OK`` (0) on success, or a non-zero ``Error`` code on failure.
func save_to_disk(data: GameSaveData, path: String, binary: bool) -> int:
	var stem := _stem(path)
	var full_path: String = stem + (_EXT_BINARY if binary else _EXT_TEXT)

	var flags := ResourceSaver.FLAG_NONE
	if binary:
		flags = ResourceSaver.FLAG_COMPRESS

	var err: int = ResourceSaver.save(data, full_path, flags)
	return err


## Load a ``GameSaveData`` from *path*.
##
## Resolution order when *path* has no recognised extension:
##   1. ``<path>.tres`` — text format
##   2. ``<path>.res``  — binary format
##
## When *path* already ends with ``.tres`` or ``.res`` that exact file is
## loaded (preferred exact-extension match).
##
## Returns ``null`` if no matching file can be found or loading fails.
func load_from_disk(path: String) -> GameSaveData:
	# Determine the ordered list of candidate paths to try.
	var candidates: Array[String] = []

	if path.ends_with(_EXT_TEXT) or path.ends_with(_EXT_BINARY):
		# Caller already provided a full extension – honour it exactly first,
		# then fall back to the other extension in case they guessed wrong.
		candidates.append(path)
		var stem := _stem(path)
		if path.ends_with(_EXT_TEXT):
			candidates.append(stem + _EXT_BINARY)
		else:
			candidates.append(stem + _EXT_TEXT)
	else:
		# No extension provided – try text then binary.
		candidates.append(path + _EXT_TEXT)
		candidates.append(path + _EXT_BINARY)

	for candidate in candidates:
		if ResourceLoader.exists(candidate):
			var res = ResourceLoader.load(candidate, "GameSaveData", ResourceLoader.CACHE_MODE_IGNORE)
			if res is GameSaveData:
				return res as GameSaveData

	push_error("SaveManager.load_from_disk: no valid save file found for path '%s'" % path)
	return null


## Compute a deterministic SHA-256 hex digest of all exported fields in *data*
## (including every nested ``ItemData``).
##
## Field encoding (all concatenated in order, no separators between tokens):
##   player_position.x  (float → String)
##   "|"
##   player_position.y  (float → String)
##   "|"
##   last_played        (int → String)
##   "|"
##   for each unlocked level:
##     level_id + "|"
##   "|||"              (inventory separator)
##   for each ItemData in inventory:
##     item.id + "|" + str(item.quantity) + "|" + str(item.rarity) + "|"
##
## Two ``GameSaveData`` instances with identical field values (same item order)
## will always produce the same digest; any difference in any field – including
## item order – changes the digest.
func compute_hash(data: GameSaveData) -> String:
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)

	# player_position
	var pos_str := str(data.player_position.x) + "|" + str(data.player_position.y) + "|"
	ctx.update(pos_str.to_utf8_buffer())

	# last_played
	var lp_str := str(data.last_played) + "|"
	ctx.update(lp_str.to_utf8_buffer())

	# unlocked_levels
	for level_id in data.unlocked_levels:
		ctx.update((level_id + "|").to_utf8_buffer())

	# inventory separator (ensures level list and inventory are distinct)
	ctx.update("|||".to_utf8_buffer())

	# inventory items
	for item in data.inventory:
		var item_str := item.id + "|" + str(item.quantity) + "|" + str(item.rarity) + "|"
		ctx.update(item_str.to_utf8_buffer())

	var digest: PackedByteArray = ctx.finish()

	# Convert raw bytes to lowercase hex string.
	var hex := ""
	for byte in digest:
		hex += "%02x" % byte
	return hex
