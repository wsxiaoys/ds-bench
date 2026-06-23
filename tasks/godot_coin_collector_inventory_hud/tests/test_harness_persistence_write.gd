extends Node


func _ready() -> void:
	var inv := get_node_or_null("/root/Inventory")
	if inv == null:
		printerr("FAIL: Inventory autoload not found at /root/Inventory")
		get_tree().quit(2)
		return

	# Ensure no leftover save influences the count (best-effort, see verifier).
	if int(inv.call("get_count")) != 0:
		# Some implementations may have auto-loaded a count > 0. We expect the
		# verifier to have cleared the save directory, so warn but continue.
		printerr("WARN: starting count is %d, expected 0" % int(inv.call("get_count")))

	var starting_count: int = int(inv.call("get_count"))

	inv.call("add_coin")
	inv.call("add_coin")
	inv.call("add_coin")

	await get_tree().process_frame

	var written_count: int = int(inv.call("get_count"))
	if written_count != starting_count + 3:
		printerr("FAIL: after 3 add_coin(), count expected %d, got %d" % [starting_count + 3, written_count])
		get_tree().quit(3)
		return

	# Explicitly persist.
	inv.call("save")
	await get_tree().process_frame

	print("PERSIST_WRITE_OK count=%d" % written_count)
	get_tree().quit(0)
