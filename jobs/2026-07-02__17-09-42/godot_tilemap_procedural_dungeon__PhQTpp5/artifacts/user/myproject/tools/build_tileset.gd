extends SceneTree
## One-shot bootstrap helper.  Run with:
##   godot --headless --script res://tools/build_tileset.gd
##
## Builds /home/user/myproject/tilesets/dungeon.tres from the PNG that lives
## at res://tilesets/dungeon_tiles.png.  Idempotent.

const TILESET_PATH := "res://tilesets/dungeon.tres"
const TILESET_ABS := "/home/user/myproject/tilesets/dungeon.tres"
const TEXTURE_PATH := "res://tilesets/dungeon_tiles.png"
const TILE_SIZE := Vector2i(16, 16)

func _init() -> void:
	var tex := load(TEXTURE_PATH) as Texture2D
	assert(tex != null, "Missing texture at %s" % TEXTURE_PATH)

	var ts := TileSet.new()
	ts.tile_size = TILE_SIZE

	var atlas := TileSetAtlasSource.new()
	atlas.texture = tex
	atlas.texture_region_size = TILE_SIZE
	atlas.margins = Vector2i.ZERO
	atlas.separation = Vector2i.ZERO

	# Three logical tiles laid out left-to-right at (0,0), (1,0), (2,0).
	# Make sure they exist by calling create_tile for each one.
	for atlas_pos in [Vector2i(0, 0), Vector2i(1, 0), Vector2i(2, 0)]:
		if not atlas.has_tile(atlas_pos):
			atlas.create_tile(atlas_pos)

	# source_id 0 is the first source added to a TileSet.
	ts.add_source(atlas, 0)

	var save_err := ResourceSaver.save(ts, TILESET_PATH)
	if save_err != OK:
		push_error("Failed to save tileset: %s" % save_err)
		quit(1)
		return

	print("Wrote ", TILESET_ABS)
	print("Sources: ", ts.get_source_count())
	for i in range(ts.get_source_count()):
		var src := ts.get_source(i)
		print("  source_id=%d  type=%s" % [i, src.get_class()])
		if src is TileSetAtlasSource:
			var a: TileSetAtlasSource = src
			print("    texture_region_size=%s  texture=%s" % [a.texture_region_size, a.texture.get_size()])

	quit(0)