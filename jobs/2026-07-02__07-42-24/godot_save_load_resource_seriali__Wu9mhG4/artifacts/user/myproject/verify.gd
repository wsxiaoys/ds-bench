extends SceneTree

func _init():
	print("--- STARTING SAVE/LOAD VERIFICATION ---")
	
	# 1. Create data
	var data := GameSaveData.new()
	data.player_position = Vector2(120.5, -450.75)
	data.last_played = 1719876543
	data.unlocked_levels = PackedStringArray(["Level 1", "Level 2", "Secret Level"])
	
	var item1 := ItemData.new()
	item1.id = "sword_iron"
	item1.quantity = 1
	item1.rarity = 2
	
	var item2 := ItemData.new()
	item2.id = "potion_health"
	item2.quantity = 5
	item2.rarity = 0
	
	data.inventory = [item1, item2]
	
	# Compute initial hash
	var hash_orig := SaveManager.compute_hash(data)
	print("Original Hash: ", hash_orig)
	if hash_orig == "":
		print("FAIL: Hash is empty!")
		quit(1)
		return
		
	# Test hash determinism
	var hash_orig_2 := SaveManager.compute_hash(data)
	if hash_orig != hash_orig_2:
		print("FAIL: Hash is not deterministic!")
		quit(1)
		return
		
	# Test hash sensitivity (changing a nested field)
	item2.quantity = 6
	var hash_modified := SaveManager.compute_hash(data)
	if hash_orig == hash_modified:
		print("FAIL: Hash did not change when nested quantity changed!")
		quit(1)
		return
	item2.quantity = 5 # revert
	
	# Test hash sensitivity (changing player_position)
	data.player_position = Vector2(120.5, -450.7)
	var hash_modified_pos := SaveManager.compute_hash(data)
	if hash_orig == hash_modified_pos:
		print("FAIL: Hash did not change when player_position changed!")
		quit(1)
		return
	data.player_position = Vector2(120.5, -450.75) # revert
	
	# Test hash sensitivity (changing unlocked_levels order)
	data.unlocked_levels = PackedStringArray(["Level 2", "Level 1", "Secret Level"])
	var hash_modified_levels := SaveManager.compute_hash(data)
	if hash_orig == hash_modified_levels:
		print("FAIL: Hash did not change when unlocked_levels order changed!")
		quit(1)
		return
	data.unlocked_levels = PackedStringArray(["Level 1", "Level 2", "Secret Level"]) # revert

	# 2. Test saving and path normalization
	# Clear existing test files first
	var dir := DirAccess.open("user://")
	if dir:
		if dir.file_exists("test_save.tres"):
			dir.remove("test_save.tres")
		if dir.file_exists("test_save.res"):
			dir.remove("test_save.res")
			
	# Save text (tres) using path without extension
	var err_tres := SaveManager.save_to_disk(data, "user://test_save", false)
	if err_tres != OK:
		print("FAIL: save_to_disk (text, no ext) failed with error: ", err_tres)
		quit(1)
		return
		
	if not FileAccess.file_exists("user://test_save.tres"):
		print("FAIL: Normalized text save file 'user://test_save.tres' does not exist!")
		quit(1)
		return
		
	if FileAccess.file_exists("user://test_save.res"):
		print("FAIL: Binary file should not exist yet!")
		quit(1)
		return
		
	# Save binary (res) using path with .tres extension (should normalize to .res)
	var err_res := SaveManager.save_to_disk(data, "user://test_save.tres", true)
	if err_res != OK:
		print("FAIL: save_to_disk (binary, .tres input) failed with error: ", err_res)
		quit(1)
		return
		
	if not FileAccess.file_exists("user://test_save.res"):
		print("FAIL: Normalized binary save file 'user://test_save.res' does not exist!")
		quit(1)
		return
		
	print("Save and path normalization tests passed.")
	
	# 3. Test Loading and Round-trip
	# Load from exact .tres
	var loaded_tres := SaveManager.load_from_disk("user://test_save.tres")
	if loaded_tres == null:
		print("FAIL: Failed to load from 'user://test_save.tres'")
		quit(1)
		return
		
	# Load from exact .res
	var loaded_res := SaveManager.load_from_disk("user://test_save.res")
	if loaded_res == null:
		print("FAIL: Failed to load from 'user://test_save.res'")
		quit(1)
		return
		
	# Helper to verify structural equality
	var verify_equality = func(loaded: GameSaveData, label: String) -> bool:
		if loaded.player_position != data.player_position:
			print("FAIL [", label, "]: player_position mismatch: ", loaded.player_position, " vs ", data.player_position)
			return false
		if loaded.last_played != data.last_played:
			print("FAIL [", label, "]: last_played mismatch: ", loaded.last_played, " vs ", data.last_played)
			return false
		if loaded.unlocked_levels != data.unlocked_levels:
			print("FAIL [", label, "]: unlocked_levels mismatch: ", loaded.unlocked_levels, " vs ", data.unlocked_levels)
			return false
		if loaded.inventory.size() != data.inventory.size():
			print("FAIL [", label, "]: inventory size mismatch: ", loaded.inventory.size(), " vs ", data.inventory.size())
			return false
			
		for i in range(loaded.inventory.size()):
			var loaded_item = loaded.inventory[i]
			var orig_item = data.inventory[i]
			if loaded_item == null:
				print("FAIL [", label, "]: loaded item at index ", i, " is null")
				return false
			if loaded_item.get_script() != ItemData:
				print("FAIL [", label, "]: loaded item at index ", i, " is not ItemData script")
				return false
			if loaded_item.id != orig_item.id:
				print("FAIL [", label, "]: loaded item id mismatch at index ", i, ": ", loaded_item.id, " vs ", orig_item.id)
				return false
			if loaded_item.quantity != orig_item.quantity:
				print("FAIL [", label, "]: loaded item quantity mismatch at index ", i, ": ", loaded_item.quantity, " vs ", orig_item.quantity)
				return false
			if loaded_item.rarity != orig_item.rarity:
				print("FAIL [", label, "]: loaded item rarity mismatch at index ", i, ": ", loaded_item.rarity, " vs ", orig_item.rarity)
				return false
				
		# Check hash matches
		var hash_loaded := SaveManager.compute_hash(loaded)
		if hash_loaded != hash_orig:
			print("FAIL [", label, "]: hash of loaded data mismatch: ", hash_loaded, " vs ", hash_orig)
			return false
			
		return true

	if not verify_equality.call(loaded_tres, "TRES"):
		quit(1)
		return
		
	if not verify_equality.call(loaded_res, "RES"):
		quit(1)
		return
		
	print("Round-trip structural equality and hash verification passed.")
	
	# 4. Test loading fallbacks and preferences
	# If we request load_from_disk with no extension, it should find one of them
	var loaded_no_ext := SaveManager.load_from_disk("user://test_save")
	if loaded_no_ext == null:
		print("FAIL: load_from_disk with no extension returned null")
		quit(1)
		return
	print("Load with no extension passed.")
	
	# If we delete .tres, and request .tres, it should fallback to .res
	dir.remove("test_save.tres")
	if FileAccess.file_exists("user://test_save.tres"):
		print("FAIL: Failed to delete 'user://test_save.tres' for fallback test")
		quit(1)
		return
		
	var loaded_fallback := SaveManager.load_from_disk("user://test_save.tres")
	if loaded_fallback == null:
		print("FAIL: load_from_disk fallback to .res failed when .tres was requested but missing")
		quit(1)
		return
	if not verify_equality.call(loaded_fallback, "FALLBACK_TO_RES"):
		quit(1)
		return
	print("Fallback from .tres to .res passed.")
	
	# Clean up and save .tres again to test the reverse fallback
	var err_tres_2 := SaveManager.save_to_disk(data, "user://test_save", false)
	if err_tres_2 != OK:
		print("FAIL: Failed to recreate .tres for reverse fallback test")
		quit(1)
		return
		
	dir.remove("test_save.res")
	if FileAccess.file_exists("user://test_save.res"):
		print("FAIL: Failed to delete 'user://test_save.res' for reverse fallback test")
		quit(1)
		return
		
	var loaded_fallback_reverse := SaveManager.load_from_disk("user://test_save.res")
	if loaded_fallback_reverse == null:
		print("FAIL: load_from_disk fallback to .tres failed when .res was requested but missing")
		quit(1)
		return
	if not verify_equality.call(loaded_fallback_reverse, "FALLBACK_TO_TRES"):
		quit(1)
		return
	print("Fallback from .res to .tres passed.")
	
	print("--- ALL VERIFICATIONS PASSED SUCCESSFULLY ---")
	quit(0)
