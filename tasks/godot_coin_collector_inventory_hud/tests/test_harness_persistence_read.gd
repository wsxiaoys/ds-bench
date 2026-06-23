extends Node


func _ready() -> void:
	var inv := get_node_or_null("/root/Inventory")
	if inv == null:
		printerr("FAIL: Inventory autoload not found at /root/Inventory")
		get_tree().quit(2)
		return

	await get_tree().process_frame

	var count: int = int(inv.call("get_count"))
	if count != 3:
		# Try to explicitly load before failing — the spec requires startup auto-load,
		# but allow implementations that only load on explicit call as a fallback.
		inv.call("load")
		await get_tree().process_frame
		count = int(inv.call("get_count"))

	if count != 3:
		printerr("FAIL: persisted count expected 3, got %d" % count)
		get_tree().quit(3)
		return

	print("PERSIST_READ_OK count=%d" % count)
	get_tree().quit(0)
