extends SceneTree

func _init():
	print("Generating tileset...")
	
	var tileset = TileSet.new()
	tileset.tile_size = Vector2i(16, 16)
	
	var img0 = Image.create(16, 16, false, Image.FORMAT_RGBA8)
	img0.fill(Color(0.2, 0.2, 0.2))
	var tex0 = ImageTexture.create_from_image(img0)
	
	var src0 = TileSetAtlasSource.new()
	src0.texture = tex0
	src0.texture_region_size = Vector2i(16, 16)
	src0.create_tile(Vector2i(0, 0))
	tileset.add_source(src0, 0)
	
	var img1 = Image.create(16, 16, false, Image.FORMAT_RGBA8)
	img1.fill(Color(0.6, 0.6, 0.6))
	var tex1 = ImageTexture.create_from_image(img1)
	
	var src1 = TileSetAtlasSource.new()
	src1.texture = tex1
	src1.texture_region_size = Vector2i(16, 16)
	src1.create_tile(Vector2i(0, 0))
	tileset.add_source(src1, 1)
	
	var img2 = Image.create(16, 16, false, Image.FORMAT_RGBA8)
	img2.fill(Color(0.6, 0.3, 0.1))
	var tex2 = ImageTexture.create_from_image(img2)
	
	var src2 = TileSetAtlasSource.new()
	src2.texture = tex2
	src2.texture_region_size = Vector2i(16, 16)
	src2.create_tile(Vector2i(0, 0))
	tileset.add_source(src2, 2)
	
	ResourceSaver.save(tileset, "res://tilesets/dungeon.tres")
	print("Tileset saved.")
	quit()
