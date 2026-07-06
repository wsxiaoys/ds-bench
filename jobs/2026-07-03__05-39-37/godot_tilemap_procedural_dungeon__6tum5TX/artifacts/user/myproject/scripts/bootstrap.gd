@tool
extends SceneTree
## Bootstrap script: generates the placeholder dungeon tile texture (PNG) and
## the TileSet resource (dungeon.tres) with three logical tiles addressable as
## source_id 0 (floor), 1 (wall) and 2 (door).
##
## Run with:
##   godot --headless --path /home/user/myproject --script scripts/bootstrap.gd
##
## This produces res://tilesets/dungeon.png and res://tilesets/dungeon.tres.
## Nothing here is hand-edited art: the PNG is drawn from solid colors.

const TILE_SIZE := 16
const PNG_PATH := "res://tilesets/dungeon.png"
const TRES_PATH := "res://tilesets/dungeon.tres"

func _init() -> void:
	_build_assets()
	quit()


func _build_assets() -> void:
	# 1) Build a 48x16 image: three solid 16x16 cells side by side.
	var img := Image.create(TILE_SIZE * 3, TILE_SIZE, false, Image.FORMAT_RGBA8)
	# Floor (source 0)  - dark grey
	img.fill_rect(Rect2i(0, 0, TILE_SIZE, TILE_SIZE), Color(0.22, 0.20, 0.26))
	# Wall  (source 1)  - light grey
	img.fill_rect(Rect2i(TILE_SIZE, 0, TILE_SIZE, TILE_SIZE), Color(0.78, 0.78, 0.82))
	# Door  (source 2)  - amber
	img.fill_rect(Rect2i(TILE_SIZE * 2, 0, TILE_SIZE, TILE_SIZE), Color(0.85, 0.62, 0.20))

	var err := img.save_png(PNG_PATH)
	if err != OK:
		push_error("Failed to save dungeon.png: %d" % err)
		return

	# 2) Build three 16x16 sub-images (one per tile). Each TileSetAtlasSource
	#    gets its own full 16x16 texture so the single tile lives at
	#    atlas_coords (0, 0) -- this keeps set_cell(coords, src, Vector2i(0,0))
	#    valid for every source_id.
	var floor_tex := ImageTexture.create_from_image(img.get_region(Rect2i(0, 0, TILE_SIZE, TILE_SIZE)))
	var wall_tex := ImageTexture.create_from_image(img.get_region(Rect2i(TILE_SIZE, 0, TILE_SIZE, TILE_SIZE)))
	var door_tex := ImageTexture.create_from_image(img.get_region(Rect2i(TILE_SIZE * 2, 0, TILE_SIZE, TILE_SIZE)))

	# 3) Build the TileSet with three single-tile atlas sources.
	var ts := TileSet.new()
	ts.tile_size = Vector2i(TILE_SIZE, TILE_SIZE)

	# add_source(source, atlas_id_override) -> assigned source id. We force 0/1/2.
	ts.add_source(_make_source(floor_tex), 0)
	ts.add_source(_make_source(wall_tex), 1)
	ts.add_source(_make_source(door_tex), 2)

	err = ResourceSaver.save(ts, TRES_PATH)
	if err != OK:
		push_error("Failed to save dungeon.tres: %d" % err)
		return

	print("Bootstrap: wrote %s and %s" % [PNG_PATH, TRES_PATH])


func _make_source(tex: Texture2D) -> TileSetAtlasSource:
	var src := TileSetAtlasSource.new()
	src.texture = tex
	# margins / separation default to 0; create the single tile at (0, 0).
	src.create_tile(Vector2i(0, 0))
	return src