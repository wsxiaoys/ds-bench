extends Node


func _ready() -> void:
	var inv := get_node_or_null("/root/Inventory")
	if inv == null:
		printerr("FAIL: Inventory autoload not found at /root/Inventory")
		get_tree().quit(2)
		return

	# Required methods.
	var required_methods := ["add_coin", "get_count", "save", "load"]
	for m in required_methods:
		if not inv.has_method(m):
			printerr("FAIL: Inventory is missing required method: ", m)
			get_tree().quit(3)
			return

	# Required signal.
	if not inv.has_signal("coin_changed"):
		printerr("FAIL: Inventory is missing required signal: coin_changed")
		get_tree().quit(4)
		return

	# Snapshot starting count (allow whatever the autoload's _ready left it at).
	var initial_count: int = int(inv.call("get_count"))

	# Subscribe to coin_changed and remember every value the signal carries.
	var signal_values: Array = []
	var receiver := _SignalReceiver.new(signal_values)
	add_child(receiver)
	inv.connect("coin_changed", Callable(receiver, "on_coin_changed"))

	# Trigger three add_coin calls.
	inv.call("add_coin")
	inv.call("add_coin")
	inv.call("add_coin")

	await get_tree().process_frame

	var expected_count := initial_count + 3
	var actual_count: int = int(inv.call("get_count"))
	if actual_count != expected_count:
		printerr("FAIL: get_count() expected %d after 3 adds, got %d" % [expected_count, actual_count])
		get_tree().quit(5)
		return

	if signal_values.size() != 3:
		printerr("FAIL: expected coin_changed to fire 3 times, got %d (values=%s)" % [signal_values.size(), str(signal_values)])
		get_tree().quit(6)
		return

	for i in range(3):
		var expected_val := initial_count + i + 1
		if int(signal_values[i]) != expected_val:
			printerr("FAIL: coin_changed call #%d expected %d, got %s" % [i, expected_val, str(signal_values[i])])
			get_tree().quit(7)
			return

	# HUD update via signal.
	var hud_packed: PackedScene = load("res://scenes/HUD.tscn")
	if hud_packed == null:
		printerr("FAIL: could not load res://scenes/HUD.tscn")
		get_tree().quit(8)
		return

	var hud := hud_packed.instantiate()
	get_tree().root.add_child(hud)
	await get_tree().process_frame
	await get_tree().process_frame

	var label := _find_label(hud)
	if label == null:
		printerr("FAIL: HUD does not contain any Label child")
		get_tree().quit(9)
		return

	inv.call("add_coin")
	await get_tree().process_frame
	await get_tree().process_frame

	var expected_text := str(initial_count + 4)
	var hud_text: String = String(label.text)
	if not hud_text.contains(expected_text):
		printerr("FAIL: HUD Label text does not contain '%s' after add_coin; got '%s'" % [expected_text, hud_text])
		get_tree().quit(10)
		return

	print("HARNESS_OK")
	get_tree().quit(0)


func _find_label(node: Node) -> Label:
	if node is Label:
		return node
	for child in node.get_children():
		var result := _find_label(child)
		if result != null:
			return result
	return null


class _SignalReceiver extends Node:
	var sink: Array

	func _init(arr: Array) -> void:
		sink = arr

	func on_coin_changed(value) -> void:
		sink.append(value)
